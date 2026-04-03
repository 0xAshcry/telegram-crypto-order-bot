import { Router } from "express";
import { orderRouter } from "./order.routes";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "API is running",
  });
});

router.use("/orders", orderRouter);
