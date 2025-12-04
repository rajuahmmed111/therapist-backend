import { ObjectId, Types } from 'mongoose';
import IUser from './user.interface';
import User from './user.model';
import PatientProfile from '../profileModule/patientProfile/patientProfile.model';
import TherapistProfile from '../profileModule/therapistProfile/therapistProfile.model';
import jwtHelpers from '../../../healpers/healper.jwt';
import config from '../../../config';

// service for create new user
const createUser = async (data: IUser) => {
    return await User.create(data);
};

// service for get specific user
const getSpecificUser = async (id: string): Promise<IUser> => {
    return await User.findOne({ _id: id })
        .populate({
            path: 'profile',
            select: '',
        })
        .select('-password');
};

// service for get specific user
const getAllUser = async (role: string, searchQuery: string, skip: number, limit: number): Promise<IUser[]> => {
    const query: any = {};
    if (role) {
        query.role = role;
    }

    if (searchQuery) {
        query.$text = { $search: searchQuery };
    }

    return await User.find(query)
        .populate({
            path: 'profile',
            select: '',
        })
        .select('-password')
        .skip(skip)
        .limit(limit);
};

// service for get specific user
const getSpecificUserByEmail = async (email: string): Promise<IUser> => {
    return await User.findOne({ email })
        .populate({
            path: 'profile',
            select: '',
        })
        .select('-password');
};

// service for update specific user
const updateSpecificUser = async (id: string, data: Partial<IUser>) => {
    console.log(data);
    return await User.updateOne({ _id: id }, data);
};

// service for delete specific user
const deleteSpecificUser = async (id: string, role: string) => {
    await User.deleteOne({ _id: id });
    if (role === 'patient') {
        await PatientProfile.deleteOne({ user: id });
    } else if (role === 'therapist') {
        await TherapistProfile.deleteOne({ user: id });
    } else {
        return false;
    }
    return true;
};

// service for get all document for user
const getAllDocuments = async () => {
    return await User.countDocuments();
};


export const socialAuthIntoDb = async (data: Partial<IUser>) => {

   
  data.isEmailVerified = true;

  const isExistEmail: any = await User.findOne({ email: data.email, isEmailVerified: true, isProvider: data.isProvider }).lean();
  let accessToken, refreshToken;

  if (isExistEmail) {
    const payload = {
      email: isExistEmail.email,
      role: isExistEmail.role,
    };
    accessToken = jwtHelpers.createToken(
      payload,
      config.jwt_access_token_secret as string,
      config.jwt_access_token_expiresin as string,
    );
    refreshToken = jwtHelpers.createToken(
      payload,
      config.jwt_refresh_token_secret as string,
      config.jwt_refresh_token_expiresin as string,
    );
    const isEmailVerified = isExistEmail?.isEmailVerified;

    return {
      firstName: isExistEmail?.firstName,
      lastName: isExistEmail?.lastName,
      email: isExistEmail?.email,
      _id: isExistEmail?._id,
      role: isExistEmail?.role,
    
      accessToken,
      refreshToken,
      isEmailVerified,
    };
  }

  const result = await User.create(data);
  const payload = {
    email: result.email,
    role: result.role,
  };
  accessToken = jwtHelpers.createToken(
    payload,
    config.jwt_access_token_secret as string,
    config.jwt_access_token_expiresin as string,
  );
  refreshToken = jwtHelpers.createToken(
    payload,
    config.jwt_refresh_token_secret as string,
    config.jwt_refresh_token_expiresin as string,
  );

  return {
    firstName: result?.firstName,
    lastName: result?.lastName,
    email: result?.email,
    _id: result?._id,
    role: result?.role,
    accessToken,
    refreshToken,
    isEmailVerified: result?.isEmailVerified,
  };
};


  

export default {
    createUser,
    getSpecificUser,
    getSpecificUserByEmail,
    updateSpecificUser,
    deleteSpecificUser,
    getAllUser,
    getAllDocuments,
    
};
