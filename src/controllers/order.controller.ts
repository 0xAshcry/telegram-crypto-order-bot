import { Request, Response } from "express";
import {
  approveOrderService,
  createOrderService,
  getAllOrdersService,
  getOrderByIdService,
  getPendingOrdersService,
  rejectOrderService,
  uploadOrderProofService,
} from "../services/order.service";
import { errorResponse, successResponse } from "../utils/response";

export const createOrderController = async (req: Request, res: Response) => {
  try {
    const { telegramId, username, coinSymbol, rupiahAmount, paymentMethod } = req.body;

    const order = await createOrderService({
      telegramId,
      username,
      coinSymbol,
      rupiahAmount: Number(rupiahAmount),
      paymentMethod,
    });

    return res.status(201).json(successResponse("Order berhasil dibuat", order));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan saat membuat order";

    return res.status(400).json(errorResponse(message));
  }
};

export const uploadOrderProofController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const file = req.file;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json(errorResponse("Order ID tidak valid"));
    }

    if (!file) {
      return res.status(400).json(errorResponse("File bukti transfer wajib diunggah"));
    }

    const proofImageUrl = `/uploads/${file.filename}`;
    const order = await uploadOrderProofService(orderId, proofImageUrl);

    return res.json(successResponse("Bukti transfer berhasil diunggah", order));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengunggah bukti transfer";

    return res.status(400).json(errorResponse(message));
  }
};

export const getPendingOrdersController = async (_req: Request, res: Response) => {
  try {
    const orders = await getPendingOrdersService();

    return res.json(successResponse("Daftar order pending verifikasi berhasil diambil", orders));
  } catch {
    return res.status(500).json(errorResponse("Gagal mengambil order pending verifikasi"));
  }
};

export const approveOrderController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const { adminName } = req.body ?? {};

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json(errorResponse("Order ID tidak valid"));
    }

    const order = await approveOrderService(orderId, adminName);

    return res.json(successResponse("Order berhasil di-approve", order));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal approve order";

    return res.status(400).json(errorResponse(message));
  }
};

export const rejectOrderController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const { adminName, notes } = req.body ?? {};

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json(errorResponse("Order ID tidak valid"));
    }

    const order = await rejectOrderService(orderId, adminName, notes);

    return res.json(successResponse("Order berhasil di-reject", order));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal reject order";

    return res.status(400).json(errorResponse(message));
  }
};

export const getAllOrdersController = async (_req: Request, res: Response) => {
  try {
    const orders = await getAllOrdersService();

    return res.json(successResponse("Daftar order berhasil diambil", orders));
  } catch {
    return res.status(500).json(errorResponse("Gagal mengambil data order"));
  }
};

export const getOrderByIdController = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);

    const order = await getOrderByIdService(orderId);

    if (!order) {
      return res.status(404).json(errorResponse("Order tidak ditemukan"));
    }

    return res.json(successResponse("Detail order berhasil diambil", order));
  } catch {
    return res.status(500).json(errorResponse("Gagal mengambil detail order"));
  }
};
