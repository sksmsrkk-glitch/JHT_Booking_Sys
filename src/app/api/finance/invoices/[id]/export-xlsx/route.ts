/**
 * @file 한글 책임: `/api/finance/invoices/[id]/export-xlsx` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { NextResponse } from "next/server";
import { demoFinanceInvoice } from "@/features/finance/demo-invoices";
import { getInvoiceDetail } from "@/features/finance/queries";
import { requireFinanceUser } from "@/lib/api/auth";
import { fail, HttpError } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { summarizeInvoicePayments } from "@/lib/domain/finance.mjs";
import { buildInvoiceWorkbook } from "@/lib/domain/xlsx.mjs";

type RouteContext = { params: Promise<{ id: string }> };

/*
 * 인보이스 엑셀 다운로드 API입니다.
 *
 * 화면에 보이는 인보이스와 같은 데이터(라인아이템, 결제 요약, 일정 snapshot)를
 * XLSX 파일로 내려줍니다. preview invoice는 개발/시연용으로 로그인 없이 허용하지만,
 * 실제 인보이스는 finance 권한이 있어야 다운로드할 수 있습니다.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const invoice = await loadInvoiceForExport(request, id);
    // 남은 미수금은 confirmed payment만 차감해서 계산합니다.
    // 입금 확인 전 금액을 차감하면 미수금 follow-up이 누락될 수 있습니다.
    const paymentSummary = summarizeInvoicePayments({
      totalAmount: invoice.totalAmount,
      payments: invoice.payments.map((payment: any) => ({
        status: payment.status,
        amount: payment.amount
      }))
    });
    const workbook = buildInvoiceWorkbook({
      invoice,
      remainingAmount: paymentSummary.remainingAmount
    });

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeFilename(invoice.invoiceNo)}.xlsx"`
      }
    });
  } catch (error) {
    return fail(error);
  }
}

async function loadInvoiceForExport(request: Request, invoiceId: string) {
  // preview-* ID는 로컬 개발 중 버튼 동작과 엑셀 파일 형태를 확인하기 위한 우회입니다.
  if (invoiceId.startsWith("preview-") && !hasAuthSession(request)) {
    return demoFinanceInvoice;
  }

  const supabase = createRequestSupabaseClient(request);
  await requireFinanceUser(supabase);
  const invoice = await getInvoiceDetail(supabase, invoiceId);
  if (!invoice) {
    if (invoiceId.startsWith("preview-")) return demoFinanceInvoice;
    throw new HttpError(404, "Invoice not found");
  }
  return invoice;
}

function hasAuthSession(request: Request) {
  const authorization = request.headers.get("authorization");
  const cookie = request.headers.get("cookie") ?? "";
  return Boolean(authorization || cookie.includes("jht_access_token="));
}

function safeFilename(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "invoice";
}
