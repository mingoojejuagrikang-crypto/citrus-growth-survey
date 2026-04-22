/**
 * parser/parser.test.ts — F035 단위 테스트
 *
 * 목적: F035 커밋 2 변경사항 검증
 *   - normalizer.ts: "번" 접미사 정리
 *   - parser.ts: FIELD_DATA_TYPES 데이터형 검증
 *   - parser.ts: 활성 필드 점수 +0.05 보너스 (R3)
 *
 * 실행: node --loader ts-node/esm src/parser/parser.test.ts
 *       또는 tsx src/parser/parser.test.ts
 *
 * 참고: 이 파일은 프로덕션 번들에 포함되지 않습니다.
 *       Vite는 index.html에서 임포트된 모듈만 번들링합니다.
 */

import { normalize } from './normalizer.js';
import { parse } from './parser.js';
import type { ParserContext } from '../types.js';

// ─────────────────────────────────────────────
// 테스트 유틸리티
// ─────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, description: string): void {
  if (condition) {
    console.log(`  PASS: ${description}`);
    passCount++;
  } else {
    console.error(`  FAIL: ${description}`);
    failCount++;
  }
}

function describe(suiteName: string, fn: () => void): void {
  console.log(`\n[${suiteName}]`);
  fn();
}

// ─────────────────────────────────────────────
// 테스트 컨텍스트
// ─────────────────────────────────────────────

const ctx: ParserContext = {
  lastField: null,
  surveyType: 'growth',
  activeFields: ['treeNo', 'width', 'height'],
};

const ctxWithFruitNo: ParserContext = {
  lastField: null,
  surveyType: 'quality',
  activeFields: ['treeNo', 'fruitNo', 'fruitWeight'],
};

const ctxEmptyActive: ParserContext = {
  lastField: null,
  surveyType: 'growth',
  activeFields: [],
};

// ─────────────────────────────────────────────
// 테스트 케이스
// ─────────────────────────────────────────────

describe('normalizer: 번 접미사 정리 (F035)', () => {
  // "나무 1번" → "나무 1" (번 제거)
  const r1 = normalize('나무 1번');
  assert(r1.includes('나무') && r1.includes('1') && !r1.includes('번'),
    `normalize("나무 1번") 결과에 "번" 없음 — 실제: "${r1}"`);

  // "나무 3번" → "나무 3"
  const r2 = normalize('나무 3번');
  assert(r2.includes('3') && !r2.includes('번'),
    `normalize("나무 3번") 결과에 "번" 없음 — 실제: "${r2}"`);

  // 다른 텍스트에 영향 없음
  const r3 = normalize('횡경 155');
  assert(!r3.includes('번'), `normalize("횡경 155") 변형 없음 — 실제: "${r3}"`);
});

describe('parser: 데이터형 검증 — integer 필드 텍스트 값 (F035-이슈#3)', () => {
  // "나무 다" → treeNo 인식, value=null, isFieldOnly=true
  // (normalizer가 더 이상 "다"를 "4"로 변환하지 않으므로 텍스트가 남아 검증에서 폴백)
  const r1 = parse('나무 다', ctx);
  assert(r1.field === 'treeNo',
    `parse("나무 다") field === 'treeNo' — 실제: "${r1.field}"`);
  assert(r1.isFieldOnly === true,
    `parse("나무 다") isFieldOnly === true — 실제: ${String(r1.isFieldOnly)}`);
  assert(r1.value === null,
    `parse("나무 다") value === null — 실제: "${r1.value}"`);
  assert(r1.warning === 'data-type-mismatch',
    `parse("나무 다") warning === 'data-type-mismatch' — 실제: "${r1.warning}"`);
});

describe('parser: 데이터형 검증 — integer 필드 텍스트 값 (과실 위)', () => {
  // "과실 위" → fruitNo 인식, isFieldOnly=true
  const r1 = parse('과실 위', ctxWithFruitNo);
  assert(r1.field === 'fruitNo',
    `parse("과실 위") field === 'fruitNo' — 실제: "${r1.field}"`);
  assert(r1.isFieldOnly === true,
    `parse("과실 위") isFieldOnly === true — 실제: ${String(r1.isFieldOnly)}`);
});

describe('parser: 번 접미사 후 정수값 정상 저장 (나무 3번)', () => {
  // "나무 3번" → normalizer가 "나무 3"으로 변환 → numericValue=3, isFieldOnly=false
  const r1 = parse('나무 3번', ctx);
  assert(r1.field === 'treeNo',
    `parse("나무 3번") field === 'treeNo' — 실제: "${r1.field}"`);
  assert(r1.numericValue === 3,
    `parse("나무 3번") numericValue === 3 — 실제: ${r1.numericValue}`);
  assert(r1.isFieldOnly !== true,
    `parse("나무 3번") isFieldOnly !== true — 실제: ${String(r1.isFieldOnly)}`);
});

describe('parser: R3 활성 필드 점수 보너스', () => {
  // width가 activeFields에 있으면 없을 때보다 score가 높아야 함
  const rWith = parse('횡경 155', ctx);           // activeFields에 width 포함
  const rWithout = parse('횡경 155', ctxEmptyActive); // activeFields 비어 있음

  assert(rWith.field === 'width',
    `parse("횡경 155", with active) field === 'width' — 실제: "${rWith.field}"`);
  assert(rWithout.field === 'width',
    `parse("횡경 155", without active) field === 'width' — 실제: "${rWithout.field}"`);
  assert(rWith.score > rWithout.score,
    `활성 필드 포함 시 score 더 높음 — with: ${rWith.score}, without: ${rWithout.score}`);

  // 점수 상한 1.0 초과 없음
  assert(rWith.score <= 1.0,
    `score가 1.0 초과하지 않음 — 실제: ${rWith.score}`);
});

// ─────────────────────────────────────────────
// 결과 출력
// ─────────────────────────────────────────────

console.log(`\n=============================`);
console.log(`결과: ${passCount} passed, ${failCount} failed`);
console.log(`=============================`);

// 브라우저/Node 양쪽 환경 호환 종료 처리
if (failCount > 0) {
  // node 환경에서만 process.exit 사용 (브라우저에서는 경고만)
  if (typeof (globalThis as Record<string, unknown>)['process'] !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((globalThis as Record<string, unknown>)['process'] as any).exit(1);
  }
}
