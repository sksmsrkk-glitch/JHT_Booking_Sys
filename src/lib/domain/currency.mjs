/**
 * 통화 변환 도메인 헬퍼입니다.
 *
 * 결정(2026-07-03): 모든 내부 금액은 KRW로 계산/저장하고, 견적 통화(MYR 등)로의
 * 변환은 "발행 시점"(인보이스 생성 등 agency 노출 경계)에서만 수행합니다.
 *
 * quote_versions.exchange_rate_to_krw 의미: 견적 통화 1단위 = X KRW.
 * 따라서 KRW -> 견적 통화 변환은 KRW 금액을 rate로 나눕니다.
 * KRW 견적(통화=KRW, rate=1)은 변환해도 값이 그대로이므로 기존 데이터에 안전합니다.
 */

export function roundMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * KRW 금액을 견적 통화로 변환합니다.
 *
 * @param {number|string} amountKrw KRW 기준 금액
 * @param {number|string} exchangeRateToKrw 견적 통화 1단위당 KRW (>0)
 * @param {string} [targetCurrency] 대상 통화(생략 시 rate만으로 변환)
 * @returns {number} 대상 통화 기준 금액(소수 2자리 반올림)
 */
export function convertKrwToQuoteCurrency(amountKrw, exchangeRateToKrw, targetCurrency = null) {
  const amount = Number(amountKrw ?? 0);
  if (!Number.isFinite(amount)) return 0;

  // 통화가 KRW이면 변환하지 않습니다.
  if (typeof targetCurrency === "string" && targetCurrency.trim().toUpperCase() === "KRW") {
    return roundMoney(amount);
  }

  const rate = Number(exchangeRateToKrw ?? 1);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("exchangeRateToKrw must be a positive number to convert from KRW");
  }
  return roundMoney(amount / rate);
}
