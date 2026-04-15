/**
 * parser/index.ts — ParserService re-export
 *
 * 목적: 파서 모듈의 공개 API를 단일 진입점으로 내보냅니다.
 */

export { parse, normalize, resolveAlias, removeParticles } from './parser.js';
export { FIELD_ALIASES, getAliasesForField, isKnownAlias } from './alias.js';
export { koreanToNumber, normalizeDecimal, removeParticlesFromTokens } from './normalizer.js';
