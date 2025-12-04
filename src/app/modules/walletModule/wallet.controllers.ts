import { Request, Response } from 'express';
import asyncHandler from '../../../shared/asyncHandler';
import walletServices from './wallet.services';
import CustomError from '../../errors';
import sendResponse from '../../../shared/sendResponse';
import { StatusCodes } from 'http-status-codes';
import paymentHistoryUtils from '../paymentHistoryModule/paymentHistory.utils';
import mongoose, { Types } from 'mongoose';
import notificationUtils from '../notificationModule/notification.utils';
import invoiceServices from '../invoiceModule/invoice.services';
import { paypalServiceInstancePromise } from '../../../libs/paypal/services/paypal.services';
import { CURRENCY_ENUM } from '../../../enums/currency';
import config from '../../../config';

// controller for retrive specific wallet by user id
const getSpecificWalletByUserId = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const wallet = await walletServices.getSpecificWalletByUserId(userId);
    if (!wallet) {
        throw new CustomError.NotFoundError('Wallet not found!');
    }
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        status: 'success',
        message: 'Wallet retrieved successfully',
        data: wallet,
    });
});

// initiate wallet top-up
const initiateWalletTopUp = asyncHandler(async (req: Request, res: Response) => {
    const { amount } = req.body;
    const userId = req.user!._id;

    const paymentService = await paypalServiceInstancePromise;

    const cancelUrl = `${config.server_url}/v1/wallet/top-up/cancel`;
    const returnUrl = `${config.server_url}/v1/wallet/top-up/return`;

    const order = await paymentService.createPaypalOrder(amount, CURRENCY_ENUM.USD, cancelUrl, returnUrl, userId);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        status: 'success',
        message: 'Wallet top-up initiated successfully',
        data: {
            orderId: order.id,
            approvalUrl: order.links.find((link: { rel: string; href: string }) => link.rel === 'approve')?.href,
        },
    });
});

// controller for add balance to wallet
const returnWalletTopUp = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.query.token as string;
    // console.log(orderId)

    if (!orderId) {
        return sendResponse(res, {
            statusCode: StatusCodes.BAD_REQUEST,
            status: 'fail',
            message: 'Invalid Payment Token',
        });
    }

    const paymentService = await paypalServiceInstancePromise;
    const captureData = await paymentService.capturePaypalOrder(orderId);

    // const transactionStatus = captureData.purchase_units[0].payments.captures[0].status;
    const purchaseUnit = captureData.purchase_units[0];
    const captureInfo = purchaseUnit.payments.captures[0];

    if (captureInfo.status !== 'COMPLETED') {
        return sendResponse(res, {
            statusCode: StatusCodes.BAD_REQUEST,
            status: 'fail',
            message: 'Payment not completed. Please try again.',
        });
    }

    // extract info
    const userId = purchaseUnit.custom_id;
    const amount = parseFloat(captureInfo.amount.value);
    const currency = captureInfo.amount.currency_code;
    const transactionId = captureInfo.id;

    // update wallet
    await walletServices.handleWalletTopUpAfterPaymentCapture({
        resource: {
            id: transactionId,
            amount: {
                value: amount,
                currency_code: currency,
            },
            custom_id: userId,
        },
    });

    // sendResponse(res, {
    //     statusCode: StatusCodes.OK,
    //     status: 'success',
    //     message: 'Payment Approved.',
    // });

    return sendResponse(res, {
        statusCode: StatusCodes.OK,
        status: 'success',
        message: 'Wallet balance added successfully.',
    });
});

// controller for cancel wallet top-up
const cancelWalletTopUp = asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        status: 'success',
        message: 'Wallet top up cancel',
    });
});

export default {
    getSpecificWalletByUserId,
    initiateWalletTopUp,
    returnWalletTopUp,
    cancelWalletTopUp,
};
