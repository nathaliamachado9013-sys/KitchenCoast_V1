import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cloudinaryRouter from "./cloudinary";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cloudinaryRouter);

export default router;
