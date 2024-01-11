import databseConnect from './database/index.js';
import dotenv from 'dotenv';

dotenv.config(
    {
        path: './env'
    }
)


databseConnect()
.then(()=>{
    app.listen(process.env.PORT || 4000, ()=> {
    console.log(`server is running at port: ${process.env.PORT}`);
   })
})
.catch((error)=>{
    console.log('mongo db connection failed: ', error);
})











/*
import mongoose from "mongoose";
import {DB_NAME} from "./constants"

import express from "express"
const app = express()

(async ()=> {
    try {
       await mongoose.connect(`${process.env.MONGOODB_URI}/${DB_NAME}`)
       app.on('error', (error)=> {
        console.log("app does not call db", error);
        throw error
       })

       app.listen(process.env.PORT, ()=> {
        console.log(`app is listening on port ${process.env.PORT}`)
       })
    } catch (error) {
        console.error("ERRORE : ",error)
    }
}
)();

*/