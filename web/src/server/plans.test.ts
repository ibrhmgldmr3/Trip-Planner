import { beforeEach, describe, expect, it, vi } from "vitest";

// Veritabanı taklit edilir: sorguya verilen koşullar ve dönen satır denetlenir.
const plan = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { plan } }));

import { clientIp } from "./rate-limit";
import { deletePlan, getPlan, updatePlanStatus } from "./plans";

const DAY = 24 * 60 * 60 * 1000;
const row = (status: string, endDate: Date | null = null) => ({ id: "p1", status, endDate });

beforeEach(() => {
  plan.findFirst.mockReset();
  plan.update.mockReset();
  plan.deleteMany.mockReset();
});

describe("plan sahipliği", () => {
  it("plan yalnızca sahibinin kimliğiyle aranır; bulunamazsa 404 döner", async () => {
    plan.findFirst.mockResolvedValue(null);
    await expect(getPlan("baskasi", "p1")).rejects.toMatchObject({ status: 404 });
    expect(plan.findFirst.mock.calls[0][0].where).toEqual({ id: "p1", userId: "baskasi" });
  });

  it("başkasının planında durum değişmez ve plan silinmez", async () => {
    plan.findFirst.mockResolvedValue(null);
    plan.deleteMany.mockResolvedValue({ count: 0 });

    await expect(updatePlanStatus("baskasi", "p1", "CANCELLED")).rejects.toMatchObject({ status: 404 });
    expect(plan.update).not.toHaveBeenCalled();

    await expect(deletePlan("baskasi", "p1")).rejects.toMatchObject({ status: 404 });
    expect(plan.deleteMany.mock.calls[0][0].where).toEqual({ id: "p1", userId: "baskasi" });
  });
});

describe("plan durumu geçişleri", () => {
  const rejected = async (current: ReturnType<typeof row>, next: "PLANNED" | "CANCELLED" | "DONE") => {
    plan.findFirst.mockResolvedValue(current);
    await expect(updatePlanStatus("u1", "p1", next)).rejects.toMatchObject({ status: 409 });
    expect(plan.update).not.toHaveBeenCalled();
  };

  it("geçersiz geçişleri reddeder", async () => {
    await rejected(row("PLANNED"), "PLANNED"); // zaten o durumda
    await rejected(row("DONE"), "CANCELLED"); // gerçekleşen iptal edilemez
    await rejected(row("DONE"), "PLANNED"); // yalnızca iptal geri alınır
    await rejected(row("CANCELLED"), "DONE"); // iptal edilen gerçekleşmiş olamaz
    await rejected(row("PLANNED", new Date(Date.now() + 3 * DAY)), "DONE"); // gezi bitmedi
  });

  it("tarihi geçmiş planı gerçekleşti yapar ve tamamlanma zamanını yazar", async () => {
    plan.findFirst.mockResolvedValue(row("PLANNED", new Date(Date.now() - 3 * DAY)));
    plan.update.mockRejectedValue(new Error("dur")); // dönüşüm bu testin konusu değil
    await expect(updatePlanStatus("u1", "p1", "DONE")).rejects.toThrow("dur");
    expect(plan.update.mock.calls[0][0].data).toMatchObject({ status: "DONE", completedAt: expect.any(Date) });
  });
});

describe("istemci IP'si", () => {
  it("x-forwarded-for'da istemcinin yazdığı ilk değeri değil, vekilin eklediği son değeri alır", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp({ "x-forwarded-for": "203.0.113.7" })).toBe("203.0.113.7");
    expect(clientIp({ "x-real-ip": "203.0.113.9" })).toBe("203.0.113.9");
    expect(clientIp({})).toBe("bilinmiyor");
  });
});
