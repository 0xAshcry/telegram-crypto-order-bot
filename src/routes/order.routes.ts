import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  approveOrderController,
  createOrderController,
  getAllOrdersController,
  getOrderByIdController,
  getPendingOrdersController,
  rejectOrderController,
  uploadOrderProofController,
} from "../controllers/order.controller";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

export const orderRouter = Router();

orderRouter.get("/pending", getPendingOrdersController);
orderRouter.post("/", createOrderController);
orderRouter.post("/:id/upload-proof", upload.single("proofImage"), uploadOrderProofController);
orderRouter.post("/:id/approve", approveOrderController);
orderRouter.post("/:id/reject", rejectOrderController);
orderRouter.get("/", getAllOrdersController);
orderRouter.get("/:id", getOrderByIdController);
