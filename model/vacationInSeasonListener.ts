import * as mongoose from "mongoose";

let vacationInSeasonListenerSchema = new mongoose.Schema({
    email: String,
    skus: [String],
});
let VacationInSeasonListener = mongoose.model("VacationInSeasonListener", vacationInSeasonListenerSchema);

export default VacationInSeasonListener;