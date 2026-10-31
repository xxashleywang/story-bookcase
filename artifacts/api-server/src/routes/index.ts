import { Router, type IRouter } from "express";
import healthRouter from "./health";
import buildsRouter from "./builds";
import profilesRouter from "./profiles";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(buildsRouter);
router.use(profilesRouter);
router.use(storageRouter);

export default router;
