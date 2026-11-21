import express, { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import env from "./config/env.js";
import router from "./routes/index.js";
import notFound from "./middlewares/notFound.js";
import globalErrorHandler from "./middlewares/globalErrorHandler.js";

const app: Application = express();

const WIDGET_API_PREFIX = "/api/v1/widget";

app.use(
  cors((req, callback) => {
    const isWidgetRequest = req.url?.startsWith(WIDGET_API_PREFIX) ?? false;
    callback(null, isWidgetRequest ? { origin: true } : { origin: env.CORS_ORIGINS, credentials: true });
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "PulseDesk API is running",
  });
});

app.use("/api/v1", router);

app.use(notFound);
app.use(globalErrorHandler);

export default app;
