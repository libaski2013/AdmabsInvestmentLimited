import mongoose from 'mongoose';
const dataAuditSchema=new mongoose.Schema({action:{type:String,required:true},format:String,mode:String,collections:Number,records:Number,performedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},details:String},{timestamps:true});
export default mongoose.model('DataAudit',dataAuditSchema);
