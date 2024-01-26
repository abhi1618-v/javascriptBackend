import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/uploadFiles.js"
import {ApiResponse} from "../utils/apiResponse.js"
import jwt from "json-web-token"

const generateAccessAndRefreshToken = async(userId) => {
    try {
        const user =  await User.findById(userId)

        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        // save refreshToken into the database(mongoosedb)
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "does not generate access and refresh token")
    }
}

const options = {
    httpOnly: true,
    secure: true
}

const registerUser = asyncHandler(async(req, res)=> {
    // user detail from frontend
    const {username, email, fullname, password} = req.body;
    console.log(username)  // send data from postman

    // check validation
    if (
        [username, fullname, email, fullname, password].some((fields) => 
        fields?.trim() === "")
    ) {
        throw new ApiError(400, 'all fields are required')
    }

    // check user already register
    const existingUser = await User.findOne({
        $or : [{ username }, { email }]
    })

    if(existingUser){
        throw new ApiError(409, "user already exist")
    }

    // check file 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "avatar file is required")
    }
    
    // file upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
    // check avatar is successfully upload
    if(!avatar){
        throw new ApiError(400, "avatar file is required")
    }
    
    // create user 
    const user =  await User.create(
        {
           fullname,
           avatar: avatar.url,
           coverImage: coverImage?.url || "",
           email,
           password,
           username: username.toLowerCase()
        }
    )
    
    // remove password and refreshToken
    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    // check user is created 
    if(!userCreated){
        throw new ApiError(500, "somthing went wrong while registering the user")
    }

    // send response 
    return res.status(201).json(
        new ApiResponse(200, userCreated, "user registerd successfully")
    )

})

const loginUser = asyncHandler(async(req, res)=>{
    // get user data 
    const {email, username, password} = req.body

    // login with username or email
    if(!(username || email)){
        throw new ApiError(400, "username or email is required")
    }
    
    // chech if all field is empty
    if((username=== "" || email=== "") && password === ""){
        throw new ApiError(400, "username or email and password are required")
    }

    const user = await User.findOne(
      {$or: [{ username }, { email }]}
    )

    if(!user){
        throw new ApiError(404, "user does not find")
    }
    
    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid password")
    }
    
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    return res.status(200)
    .cookies("accessToken", accessToken, options)
    .cookies("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
            "user is successfully logged in"
        )
    )

})

const logoutUser = asyncHandler(async(req, res)=> {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
              refreshToken: undefined  
            }
        },
        {
            new: true
        }
     )

     return res.status(200)
     .cookies("accessToken", options)
     .cookies("refreshToken", options)
     .json(
        new ApiResponse(200, {}, "user successfullly logged out")
     )
})

const refreshAccessToken = asyncHandler(async(req, res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    const decodedToken = jwt.verify(incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET)

    const user = await User.findById(decodedToken._id)    

    if(!user){
        throw new ApiError(401, "invalid refresh token")
    }

    if(incomingRefreshToken !== user?.refreshToken){
        throw new ApiError(401, "regresh token is expired or used")
    }

    const {accessToken, newrefreshToken} = await generateAccessAndRefreshToken(user._id)

    return  res.status(200)
    .cookies("accessToken", accessToken, options)
    .cookies("refreshToken", newrefreshToken, options)
    .json(
        new ApiResponse(200, 
            {
             accessToken,
             refreshToken: newrefreshToken,
            },
            "access token refreshed")
    )

    
})

const changeCurrentPassword = asyncHandler(async(req, res)=> {
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.body._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "your old password is incorrect")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: flase})

    return res.status(200)
    .json(
        new ApiResponse(200, {}, "password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async(req, res)=>{
    return res.status(200)
    .json(200, req.user, "current user fetch successfully")
})

const updateProfile = asyncHandler(async(req, res)=> {
    const {fullname, email} = req.body
    
    if(!fullname && !email){
        throw new ApiError(400, "All fields are required")
    }

     const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email
            },
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200, user, "fullname and email are updated"))
})

const updateUserAvatar = asyncHandler(async(req, res)=> {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "avatart file is not find")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "avatar file is not upload properly into the cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new:true}

    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200, user, "avatar is successfully updated"))
})

const updateUserCoverImage = asyncHandler(async(req, res)=> {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "cover image is not find")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400, "cover image is not uploaded successfully on to the cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                coverImage: coverImage.url 
            }
        },
        {new: true}
    ).select("-password");

    return res.status(200)
    .json(new ApiResponse(200, user, "cover image updated successfully"))

})

const getUserChannelProfile  = asyncHandler(async(req, res)=> {
    const {username} = req.param;

    if(!username?.trim()){
       throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([{
        $match: {
            username: username?.toLowerCase()
        }
    },
    {
             $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {        
        $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
    }
    },
    {
        $addFields: {
            subscribersCount: {
                $size: "$subscribers"
            },
            subscribedToCount: {
                $size: "$subscribedTo"
            },
            isSubscribed: {
                $cond: {
                    if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project: {
            username: 1,
            fullname: 1,
            avatar: 1,
            coverImage: 1,
            coverImage: 1,
            subscribersCount: 1,
            subscribedToCount: 1,
            isSubscribed: 1,
            email: 1,
        }
    }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel not found")
    }
    
    return res.status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched sucessfully")
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateProfile,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
}
    