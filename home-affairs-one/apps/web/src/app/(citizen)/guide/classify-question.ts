/**
 * Safety rules for the service guide, as a pure function: same text in, same
 * answer out, nothing read or written anywhere.
 *
 * The guide only finds and quotes sample guidance. These two checks decide
 * what it must say before it searches, or instead of searching.
 */

export interface QuestionClassification {
  /**
   * The text looks like it carries an identity number, a document or case
   * number, a phone number or an email address. The guide must not search it.
   */
  containsPersonalData: boolean;
  /**
   * The question asks for a decision, an eligibility verdict, an outcome or a
   * timeframe. The guide must say it cannot assess those before showing guidance.
   */
  asksForDecision: boolean;
}

/** Six or more digits in a row, allowing a single space, dot or hyphen between them. */
const LONG_NUMBER = /(?:\d[\s.-]?){6,}/;

const DECISION_WORDS =
  /\b(eligible|eligibility|qualify|qualifies|qualified|approve|approved|approval|decline|declined|reject|rejected|refuse|refused|entitled|will i get|can i get|guarantee|guaranteed|how long|how soon|when will|processing time)\b/i;

export function classifyQuestion(text: string): QuestionClassification {
  return {
    containsPersonalData: LONG_NUMBER.test(text) || text.includes('@'),
    asksForDecision: DECISION_WORDS.test(text),
  };
}
