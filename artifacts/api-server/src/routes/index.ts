import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import candidatesRouter from "./candidates";
import tokensRouter from "./tokens";
import tablesRouter from "./tables";
import sessionsRouter from "./sessions";
import dashboardRouter from "./dashboard";
import sitePositionsRouter from "./site-positions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(candidatesRouter);
router.use(tokensRouter);
router.use(tablesRouter);
router.use(sessionsRouter);
router.use(dashboardRouter);
router.use(sitePositionsRouter);

export default router;
