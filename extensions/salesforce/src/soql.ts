/**
 * Escaping helpers for values interpolated into SOQL string literals.
 *
 * Salesforce has no bind-parameter API over REST, so queries are assembled as
 * strings. Any value that reaches a literal must therefore be escaped, or a
 * value containing a quote closes the literal early and the rest of it is
 * parsed as query syntax.
 */

/**
 * Escapes a value for use inside a single-quoted SOQL string literal.
 *
 * Backslash is escaped first so that the escape characters added afterwards are
 * not themselves doubled. Newline, carriage return and tab are escaped because
 * a raw control character inside a literal produces a malformed query.
 *
 * This deliberately leaves the LIKE wildcards `%` and `_` alone; in an equality
 * comparison they are already literal. Use escapeSoqlLike for LIKE operands.
 */
export const escapeSoqlString = (value: string): string =>
    String(value === undefined || value === null ? "" : value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");

/**
 * Escapes a value for use as the operand of a SOQL LIKE comparison.
 *
 * Extends escapeSoqlString with the two LIKE wildcards, so a value containing
 * `%` or `_` matches those characters literally rather than acting as a pattern.
 * A caller that wants wildcard matching must build the pattern itself around an
 * escaped value rather than passing wildcards through in user input.
 */
export const escapeSoqlLike = (value: string): string =>
    escapeSoqlString(value)
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");

/**
 * Salesforce field and relationship API names are alphanumeric with underscores,
 * and dots separate relationship traversals. A field name reaches SOQL in
 * identifier position, where quoting does not apply and escaping cannot help, so
 * anything outside that shape is rejected rather than interpolated.
 */
export const assertSoqlFieldName = (fieldName: string): string => {
    if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/.test(String(fieldName))) {
        throw new Error(`"${fieldName}" is not a valid Salesforce field name.`);
    }

    return fieldName;
};
