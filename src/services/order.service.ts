import {
  AdminActionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { CreateOrderBody } from "../types/order";

const mockRateMap: Record<string, number> = {
  BTC: 0.00000045,
  ETH: 0.000008,
  USDT: 0.000061,
};

export const createOrderService = async (payload: CreateOrderBody) => {
  const {
    telegramId,
    username,
    coinSymbol,
    rupiahAmount,
    paymentMethod,
  } = payload;

  const normalizedCoin = coinSymbol.toUpperCase();

  if (!mockRateMap[normalizedCoin]) {
    throw new Error("Coin tidak didukung. Gunakan BTC, ETH, atau USDT.");
  }

  if (rupiahAmount < 10000) {
    throw new Error("Minimal pembelian adalah Rp10.000.");
  }

  let user = await prisma.user.findUnique({
    where: { telegramId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username,
      },
    });
  }

  const estimatedCoinAmount = rupiahAmount * mockRateMap[normalizedCoin];

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      coinSymbol: normalizedCoin,
      rupiahAmount,
      estimatedCoinAmount,
      paymentMethod: paymentMethod as PaymentMethod,
    },
  });

  return order;
};

export const uploadOrderProofService = async (orderId: number, proofImageUrl: string) => {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!existingOrder) {
    throw new Error("Order tidak ditemukan.");
  }

  return prisma.order.update({
    where: { id: orderId },
    data: {
      proofImageUrl,
      paymentStatus: PaymentStatus.PENDING,
      orderStatus: OrderStatus.WAITING_VERIFICATION,
      rejectReason: null,
    },
    include: {
      user: true,
      adminActions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
};

export const getUserOrdersService = async (telegramId: string) => {
  return prisma.order.findMany({
    where: {
      user: {
        telegramId,
      },
    },
    include: {
      user: true,
      adminActions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });
};

export const getPendingOrdersService = async () => {
  return prisma.order.findMany({
    where: {
      orderStatus: OrderStatus.WAITING_VERIFICATION,
    },
    include: {
      user: true,
      adminActions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
};

export const approveOrderService = async (orderId: number, adminName?: string) => {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
    },
  });

  if (!existingOrder) {
    throw new Error("Order tidak ditemukan.");
  }

  if (existingOrder.orderStatus !== OrderStatus.WAITING_VERIFICATION) {
    throw new Error("Order ini belum siap di-approve. Status harus WAITING_VERIFICATION.");
  }

  const safeAdminName = adminName?.trim() || "unknown-admin";

  return prisma.$transaction(async (tx) => {
    await tx.adminAction.create({
      data: {
        orderId,
        adminName: safeAdminName,
        actionType: AdminActionType.APPROVE,
        notes: null,
      },
    });

    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.APPROVED,
        rejectReason: null,
      },
      include: {
        user: true,
        adminActions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return order;
  });
};

export const rejectOrderService = async (orderId: number, adminName?: string, notes?: string) => {
  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
    },
  });

  if (!existingOrder) {
    throw new Error("Order tidak ditemukan.");
  }

  if (
    existingOrder.orderStatus !== OrderStatus.WAITING_VERIFICATION &&
    existingOrder.orderStatus !== OrderStatus.WAITING_PAYMENT
  ) {
    throw new Error("Order ini tidak bisa direject pada status saat ini.");
  }

  const safeAdminName = adminName?.trim() || "unknown-admin";
  const safeNotes = notes?.trim() || "Tidak ada alasan reject.";

  return prisma.$transaction(async (tx) => {
    await tx.adminAction.create({
      data: {
        orderId,
        adminName: safeAdminName,
        actionType: AdminActionType.REJECT,
        notes: safeNotes,
      },
    });

    const order = await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.REJECTED,
        orderStatus: OrderStatus.REJECTED,
        rejectReason: safeNotes,
      },
      include: {
        user: true,
        adminActions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return order;
  });
};

export const getAllOrdersService = async () => {
  return prisma.order.findMany({
    include: {
      user: true,
      adminActions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getOrderByIdService = async (id: number) => {
  return prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      adminActions: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
};
