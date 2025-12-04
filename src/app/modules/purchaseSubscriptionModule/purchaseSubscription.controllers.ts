import { Types } from 'mongoose';

import { Request, Response } from 'express';
import asyncHandler from '../../../shared/asyncHandler';
import purchaseSubscriptionService from './purchaseSubscription.services';
import sendResponse from '../../../shared/sendResponse';
import CustomError from '../../errors';
import { StatusCodes } from 'http-status-codes';
import notificationUtils from '../notificationModule/notification.utils';
import paymentHistoryUtils from '../paymentHistoryModule/paymentHistory.utils';
import subscriptionService from '../subscriptionModule/subscription.service';
import therapistProfessionalUtils from '../professionalModule/therapistProfessional/therapistProfessional.utils';
import { paypalServiceInstancePromise } from '../../../libs/paypal/services/paypal.services';

// // Controller for creating a new purchase subscription
// const createPurchaseSubscription = asyncHandler(async (req: Request, res: Response) => {
//     const subscriptionData = req.body;

//     const subscription = await subscriptionService.getSpecificSubscription(subscriptionData.subscription);
//     if (!subscription) {
//         throw new CustomError.BadRequestError('Invalid subscription!');
//     }

//     // Check if there is an active subscription for the user
//     const existingActiveSubscription = await purchaseSubscriptionService.getPurchasedAndActiveSubscriptionByUserId(subscriptionData.user);
//     // console.log(existingActiveSubscription, 'existingActiveSubscription');
//     if (existingActiveSubscription) {
//         // If there is an active subscription, deactivate it
//         await purchaseSubscriptionService.inactiveSubscriptionByUserIdAndSubscriptionId(
//             subscriptionData.user,
//             existingActiveSubscription.subscription as unknown as string,
//         );
//     }

//     // Create the new subscription
//     const newSubscription = await purchaseSubscriptionService.createPurchaseSubscription(subscriptionData);
//     // console.log(newSubscription, 'newSubscription');
//     if (!newSubscription) {
//         throw new CustomError.BadRequestError('Failed to purchase subscription!');
//     }

//     // create or update therapist professional
//     await therapistProfessionalUtils.createOrUpdateTherapistProfessional(subscriptionData.user, {
//         therapist: subscriptionData.user,
//     });
//     // console.log(therapistProfessional, 'therapistProfessional');

//     // create notification for purchase subscription
//     const notificationPayload = {
//         consumer: subscriptionData.user,
//         content: {
//             title: 'Subscription Purchased',
//             message: 'You have successfully purchased a subscription',
//             source: {
//                 type: 'Subscription',
//                 id: newSubscription.subscription,
//             },
//         },
//         isDismissed: false,
//     };
//     await notificationUtils.createNotification(notificationPayload);

//     // create payment history
//     const paymentHistoryPayload = {
//         user: subscriptionData.user,
//         purpose: 'Subscription Purchased',
//         transactionId: subscriptionData.paymentSource.transactionId,
//         currency: subscriptionData.paymentSource.type,
//         amount: subscription?.price.amount,
//         paymentType: 'debit',
//     };
//     // console.log(paymentHistoryPayload, 'paymentHistoryPayload');

//     await paymentHistoryUtils.createPaymentHistory(paymentHistoryPayload);
//     // console.log(paymentHistory, 'paymentHistory');
//     sendResponse(res, {
//         statusCode: StatusCodes.CREATED,
//         status: 'success',
//         message: 'Subscription successfully purchased',
//     });
// });

// Controller for creating a new purchase subscription
const createPurchaseSubscription = asyncHandler(async (req: Request, res: Response) => {
    const subscriptionData = req.body;
    const user = subscriptionData.user;
    const subscriptionId = subscriptionData.subscription;

    const subscription = await subscriptionService.getSpecificSubscription(subscriptionData.subscription);
    if (!subscription) {
        throw new CustomError.BadRequestError('Invalid subscription!');
    }

    // check if there is an active subscription for the user
    const existingActiveSubscription = await purchaseSubscriptionService.getPurchasedAndActiveSubscriptionByUserId(subscriptionData.user);
    // console.log(existingActiveSubscription, 'existingActiveSubscription');
    if (existingActiveSubscription) {
        // If there is an active subscription, deactivate it
        await purchaseSubscriptionService.inactiveSubscriptionByUserIdAndSubscriptionId(
            subscriptionData.user,
            existingActiveSubscription.subscription as unknown as string,
        );
    }

    // initialize PayPal service
    const paypalService = await paypalServiceInstancePromise;

    // create PayPal order
    // const returnUrl = `${process.env.SERVER_URL}/v1/purchase-subscription/return?user=${user}&subscription=${subscriptionId}`;
    const returnUrl = `${process.env.SERVER_URL}/v1/purchase-subscription/subscription-capture?user=${user}&subscription=${subscriptionId}`;

    const cancelUrl = `${process.env.SERVER_URL}/v1/purchase-subscription/cancel`;
    const paypalOrder = await paypalService.createPaypalOrder(
        subscription.price.amount.toString(),
        subscription.price.currency,
        cancelUrl,
        returnUrl,
        user,
    );

    const approveUrl = paypalOrder.links.find((link: any) => link.rel === 'approve')?.href;

    // send approval URL to frontend
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        status: 'success',
        message: 'PayPal order created. Approve payment to complete subscription purchase.',
        data: {
            paypalOrderId: paypalOrder.id,
            approveUrl,
        },
    });
});

const capturePurchaseSubscriptionPayment = asyncHandler(async (req: Request, res: Response) => {
    // const { orderId, user, subscription: subscriptionId } = req.query;

    const orderId = (req.query.orderId || req.query.token) as string;
    const user = req.query.user as string;
    const subscriptionId = req.query.subscription as string;

    if (!orderId) throw new CustomError.BadRequestError('Order ID missing!');

    const paypalService = await paypalServiceInstancePromise;

    const captureData = await paypalService.capturePaypalOrder(orderId as string);

    const captureInfo = captureData.purchase_units[0].payments.captures[0];

    if (captureInfo.status !== 'COMPLETED') {
        throw new CustomError.BadRequestError('Payment not completed. Try again.');
    }

    const subscription = await subscriptionService.getSpecificSubscription(subscriptionId as string);

    const purchasedSubscription = await purchaseSubscriptionService.createPurchaseSubscription({
        user: new Types.ObjectId(user),
        subscription: new Types.ObjectId(subscriptionId),

        paymentStatus: 'paid',
        paymentSource: {
            number: captureInfo.id,
            type: 'paypal',
            transactionId: captureInfo.id,
            isSaved: false,
        },
        status: 'active',
    });

    await therapistProfessionalUtils.createOrUpdateTherapistProfessional(user, {
        therapist: new Types.ObjectId(user),
    });

    await notificationUtils.createNotification({
        consumer: new Types.ObjectId(user),
        content: {
            title: 'Subscription Purchased',
            message: 'You have successfully purchased a subscription',
            source: { type: 'Subscription', id: new Types.ObjectId(subscriptionId) },
        },
        isDismissed: false,
    });

    await paymentHistoryUtils.createPaymentHistory({
        user: new Types.ObjectId(user),
        purpose: 'Subscription Purchased',
        transactionId: captureInfo.id,
        currency: subscription?.price.currency,
        amount: subscription?.price.amount,
        paymentType: 'debit',
    });

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        status: 'success',
        message: 'Subscription successfully purchased',
        data: purchasedSubscription,
    });
});

// Controller for getting purchase subscriptions
const getPurchasedAndActiveSubscriptionByUserId = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const subscription = await purchaseSubscriptionService.getPurchasedAndActiveSubscriptionByUserId(userId);

    if (!subscription) {
        throw new CustomError.NotFoundError('No purchased subscription found!!');
    }

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        status: 'success',
        message: 'Purchase Subscription retrieved successfully',
        data: subscription,
    });
});

// Controller for getting a specific purchase subscription
const inactiveSubscriptionByUserIdAndSubscriptionId = asyncHandler(async (req: Request, res: Response) => {
    const { userId, subscriptionId } = req.params;

    const subscription = await purchaseSubscriptionService.inactiveSubscriptionByUserIdAndSubscriptionId(userId, subscriptionId);

    if (!subscription?.modifiedCount) {
        throw new CustomError.NotFoundError('Failed to inactive the purchased subscription!');
    }

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        status: 'success',
        message: 'Purchase Subscription inactivated successfully',
    });
});

export default {
    createPurchaseSubscription,
    getPurchasedAndActiveSubscriptionByUserId,
    inactiveSubscriptionByUserIdAndSubscriptionId,
    capturePurchaseSubscriptionPayment,
};
