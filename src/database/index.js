import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const databseConnect = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`mongoDB connection || DB Host: ${connectionInstance}`)
    } catch (error) {
        console.log('MongoDB DB Connection Errore: ', error)
        process.exit(1)
    }

}

export default databseConnect;

