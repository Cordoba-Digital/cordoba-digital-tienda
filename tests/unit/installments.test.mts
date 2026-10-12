/**
 * Pruebas de las cuotas que muestran la ficha y las tarjetas. Los planes salen
 * de la respuesta de Mercado Pago; acá se verifica que se lean bien y que una
 * respuesta rara no termine en cuotas inventadas.
 *
 * Uso: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { bestInterestFree, installmentOptions, parseInstallmentPlans } from "../../src/lib/installments";

// Forma de `GET /v1/payment_methods/installments`, recortada.
const respuesta = [
  {
    payment_method_id: "visa",
    payment_type_id: "credit_card",
    payer_costs: [
      { installments: 1, installment_rate: 0, min_allowed_amount: 2, max_allowed_amount: 50_000_000, labels: ["CFT_0,00%|TEA_0,00%"] },
      { installments: 3, installment_rate: 0, min_allowed_amount: 2, max_allowed_amount: 50_000_000, labels: ["CFT_0,00%|TEA_0,00%"] },
      { installments: 6, installment_rate: 0, min_allowed_amount: 30_000, max_allowed_amount: 50_000_000, labels: ["CFT_0,00%|TEA_0,00%"] },
      { installments: 12, installment_rate: 45.5, min_allowed_amount: 2, max_allowed_amount: 50_000_000, labels: ["recommended_installment", "CFT_110,25%|TEA_85,10%"] },
    ],
  },
];

test("lee los planes con su CFT y TEA", () => {
  const planes = parseInstallmentPlans(respuesta);
  assert.equal(planes.length, 4);
  assert.deepEqual(planes[3], { installments: 12, rate: 45.5, minAmount: 2, maxAmount: 50_000_000, cft: "110,25%", tea: "85,10%" });
});

test("una respuesta sin tarjeta de crédito o con otra forma no da planes", () => {
  assert.deepEqual(parseInstallmentPlans(null), []);
  assert.deepEqual(parseInstallmentPlans({ message: "unauthorized" }), []);
  assert.deepEqual(parseInstallmentPlans([{ payment_type_id: "debit_card", payer_costs: respuesta[0].payer_costs }]), []);
  assert.deepEqual(parseInstallmentPlans([{ payment_type_id: "credit_card", payer_costs: [{ installments: "6" }] }]), []);
});

test("la mejor opción sin interés es la de más cuotas sin recargo", () => {
  const planes = parseInstallmentPlans(respuesta);
  const mejor = bestInterestFree(120_000, planes);
  assert.deepEqual(mejor, { installments: 6, interestFree: true, amount: 20_000, total: 120_000, cft: "0,00%", tea: "0,00%" });
});

test("respeta el monto mínimo de cada plan", () => {
  const planes = parseInstallmentPlans(respuesta);
  // $20.000 no llega al mínimo del plan de 6: queda el de 3.
  assert.equal(bestInterestFree(20_000, planes)?.installments, 3);
  assert.deepEqual(installmentOptions(20_000, planes).map((o) => o.installments), [3, 12]);
});

test("con interés, el precio final suma el recargo en pesos enteros", () => {
  const planes = parseInstallmentPlans(respuesta);
  const doce = installmentOptions(99_999, planes).find((o) => o.installments === 12);
  assert.equal(doce?.total, 145_499); // 99.999 × 1,455 = 145.498,5
  assert.equal(doce?.amount, 12_125);
  assert.equal(doce?.interestFree, false);
});

test("sin planes o sin precio no hay cuotas", () => {
  assert.equal(bestInterestFree(100_000, []), null);
  assert.deepEqual(installmentOptions(0, parseInstallmentPlans(respuesta)), []);
});
