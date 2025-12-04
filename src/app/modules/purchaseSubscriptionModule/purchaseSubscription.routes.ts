import express from 'express';
import purchaseSubscriptionControllers from './purchaseSubscription.controllers';
import authorization from '../../middlewares/authorization';

const purchaseSubscriptionRouter = express.Router();

purchaseSubscriptionRouter.post(
    '/',
    authorization('super-admin', 'admin', 'therapist', 'patient'),
    purchaseSubscriptionControllers.createPurchaseSubscription,
);

purchaseSubscriptionRouter.get(
    '/subscription-capture',
    // authorization('super-admin', 'admin', 'therapist'),
    purchaseSubscriptionControllers.capturePurchaseSubscriptionPayment,
);

purchaseSubscriptionRouter.get(
    '/retrive/user/:userId',
    authorization('super-admin', 'admin', 'therapist', 'patient'),
    purchaseSubscriptionControllers.getPurchasedAndActiveSubscriptionByUserId,
);

purchaseSubscriptionRouter.patch(
    '/inactive/user/:userId/subscription/:subscriptionId',
    authorization('super-admin', 'admin', 'therapist', 'patient'),
    purchaseSubscriptionControllers.inactiveSubscriptionByUserIdAndSubscriptionId,
);

export default purchaseSubscriptionRouter;
