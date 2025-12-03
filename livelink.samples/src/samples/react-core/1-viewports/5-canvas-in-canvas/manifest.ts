import { App } from ".";
import meta from "./meta.json";

//------------------------------------------------------------------------------
import { Sample } from "@/samples";

//------------------------------------------------------------------------------
const sample: Sample = {
    ...meta,
    path: import.meta.VITE_FILE_NAME,
    code: import.meta.VITE_FILE_CONTENT,
    component: App,
};

//------------------------------------------------------------------------------
export default sample;
