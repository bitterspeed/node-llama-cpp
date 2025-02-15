import {Token, Tokenizer} from "../types.js";
import type {InspectOptions, inspect as InspectFunction} from "node:util";

export type LlamaTextValue = string | SpecialTokensText | SpecialToken;
export type LlamaTextInputValue = LlamaTextValue | LlamaText | number | boolean | readonly LlamaTextInputValue[];

export type LlamaTextJSON = Array<LlamaTextJSONValue>;
export type LlamaTextJSONValue = string | LlamaTextSpecialTokensTextJSON | LlamaTextSpecialTokenJSON;
export type LlamaTextSpecialTokensTextJSON = {type: "specialTokensText", value: string};
export type LlamaTextSpecialTokenJSON = {type: "specialToken", value: string};

class LlamaText {
    public readonly values: readonly LlamaTextValue[];

    /**
     * Can also be called without `new`
     */
    public constructor(...values: readonly LlamaTextInputValue[]) {
        // the constructor logic is copied to `LlamaTextConstructor` to make the constructor callable as a normal function
        this.values = createHistoryFromStringsAndValues(values);
    }

    public concat(value: LlamaTextInputValue): LlamaText {
        return new LlamaTextConstructor([...this.values, value]);
    }

    public mapValues(mapper: (value: LlamaTextValue) => LlamaTextInputValue) {
        return new LlamaTextConstructor(
            this.values.map(mapper)
        );
    }

    public joinValues(separator: LlamaText | LlamaTextValue) {
        const newValues: LlamaTextValue[] = [];

        for (let i = 0; i < this.values.length; i++) {
            newValues.push(this.values[i]);

            if (i !== this.values.length - 1) {
                if (isLlamaText(separator))
                    newValues.push(...separator.values);
                else
                    newValues.push(separator);
            }
        }

        return new LlamaTextConstructor(newValues);
    }

    public toString() {
        return this.values
            .map((value) => {
                if (value instanceof SpecialToken)
                    return value.toString();
                else if (value instanceof SpecialTokensText)
                    return value.toString();
                else
                    return value;
            })
            .join("");
    }

    public toJSON(): LlamaTextJSON {
        return this.values.map((value) => {
            if (value instanceof SpecialToken)
                return value.toJSON() satisfies LlamaTextJSONValue;
            else if (value instanceof SpecialTokensText)
                return value.toJSON() satisfies LlamaTextJSONValue;
            else
                return value satisfies LlamaTextJSONValue;
        });
    }

    public tokenize(tokenizer: Tokenizer, options?: "trimLeadingSpace"): Token[] {
        let textToTokenize = "";
        const res: Token[] = [];
        const hasContent = () => (res.length > 0 || textToTokenize.length > 0);
        const resolveTokenizerOptions = () => (hasContent() ? "trimLeadingSpace" : options);

        for (const value of this.values) {
            if (value instanceof SpecialToken) {
                res.push(...tokenizer(textToTokenize, false, resolveTokenizerOptions()), ...value.tokenize(tokenizer));
                textToTokenize = "";
            } else if (value instanceof SpecialTokensText) {
                res.push(...tokenizer(textToTokenize, false, resolveTokenizerOptions()), ...value.tokenize(tokenizer, hasContent() || options === "trimLeadingSpace"));
                textToTokenize = "";
            } else
                textToTokenize += value;
        }

        res.push(...tokenizer(textToTokenize, false, resolveTokenizerOptions()));

        return res;
    }

    public compare(other: LlamaText): boolean {
        return LlamaTextConstructor.compare(this, other);
    }

    public trimStart(): LlamaText {
        const newValues = this.values.slice();

        while (newValues.length > 0) {
            const firstValue = newValues[0];

            if (firstValue instanceof SpecialToken)
                break;

            if (firstValue instanceof SpecialTokensText) {
                const newValue = firstValue.value.trimStart();
                if (newValue === "") {
                    newValues.shift();
                    continue;
                } else if (newValue !== firstValue.value) {
                    newValues[0] = new SpecialTokensText(newValue);
                    break;
                }

                break;
            } else if (typeof firstValue === "string") {
                const newValue = firstValue.trimStart();
                if (newValue === "") {
                    newValues.shift();
                    continue;
                } else if (newValue !== firstValue) {
                    newValues[0] = newValue;
                    break;
                }

                break;
            } else
                void (firstValue satisfies never);
        }

        return new LlamaTextConstructor(newValues);
    }

    public trimEnd(): LlamaText {
        const newValues = this.values.slice();

        while (newValues.length > 0) {
            const lastValue = newValues[newValues.length - 1];

            if (lastValue instanceof SpecialToken)
                break;

            if (lastValue instanceof SpecialTokensText) {
                const newValue = lastValue.value.trimEnd();
                if (newValue === "") {
                    newValues.pop();
                    continue;
                } else if (newValue !== lastValue.value) {
                    newValues[newValues.length - 1] = new SpecialTokensText(newValue);
                    break;
                }

                break;
            } else if (typeof lastValue === "string") {
                const newValue = lastValue.trimEnd();
                if (newValue === "") {
                    newValues.pop();
                    continue;
                } else if (newValue !== lastValue) {
                    newValues[newValues.length - 1] = newValue;
                    break;
                }

                break;
            } else
                void (lastValue satisfies never);
        }

        return new LlamaTextConstructor(newValues);
    }

    public includes(value: LlamaText): boolean {
        for (let i = 0; i <= this.values.length - value.values.length; i++) {
            const thisValue = this.values[i];

            let startMatch = compareLlamaTextValues(thisValue, value.values[0]);

            if (!startMatch && thisValue instanceof SpecialTokensText && value.values[0] instanceof SpecialTokensText) {
                startMatch = value.values.length > 1
                    ? thisValue.value.endsWith(value.values[0].value)
                    : thisValue.value.includes(value.values[0].value);
            }

            if (!startMatch && typeof thisValue === "string" && typeof value.values[0] === "string") {
                startMatch = value.values.length > 1
                    ? thisValue.endsWith(value.values[0])
                    : thisValue.includes(value.values[0]);
            }

            if (startMatch) {
                let j = 1;
                for (; j < value.values.length; j++) {
                    const thisValue = this.values[i + j];
                    const valueValue = value.values[j];

                    let endMatch = compareLlamaTextValues(thisValue, valueValue);

                    if (!endMatch && thisValue instanceof SpecialTokensText && valueValue instanceof SpecialTokensText) {
                        endMatch = value.values.length - 1 === j
                            ? thisValue.value.startsWith(valueValue.value)
                            : thisValue.value === valueValue.value;
                    }

                    if (!endMatch && typeof thisValue === "string" && typeof valueValue === "string") {
                        endMatch = value.values.length - 1 === j
                            ? thisValue.startsWith(valueValue)
                            : thisValue === valueValue;
                    }

                    if (!endMatch)
                        break;
                }

                if (j === value.values.length)
                    return true;
            }
        }

        return false;
    }

    /** @internal */
    public [Symbol.for("nodejs.util.inspect.custom")](
        depth: number | null, inspectOptions: InspectOptions, inspect: typeof InspectFunction
    ) {
        return "LlamaText(" + inspect(this.values, {
            ...(inspectOptions ?? {}),
            depth: depth == null
                ? undefined
                : Math.max(0, depth - 1)
        }) + ")";
    }

    public static fromJSON(json: LlamaTextJSON): LlamaText {
        // assigned to `LlamaTextConstructor` manually to expose this static method

        return new LlamaTextConstructor(
            json.map((value) => {
                if (typeof value === "string")
                    return value;
                else if (SpecialToken.isSpecialTokenJSON(value))
                    return SpecialToken.fromJSON(value);
                else if (SpecialTokensText.isSpecialTokensTextJSON(value))
                    return SpecialTokensText.fromJSON(value);
                else {
                    void (value satisfies never);
                    throw new Error(`Unknown value type: ${value}`);
                }
            })
        );
    }

    public static compare(a: LlamaText, b: LlamaText): boolean {
        // assigned to `LlamaTextConstructor` manually to expose this static method

        if (!isLlamaText(a) || !isLlamaText(b))
            return false;

        if (a.values.length !== b.values.length)
            return false;

        for (let i = 0; i < a.values.length; i++) {
            if (!compareLlamaTextValues(a.values[i], b.values[i]))
                return false;
        }

        return true;
    }
}
Object.defineProperty(LlamaText.prototype, "_type", {
    enumerable: false,
    configurable: false,
    value: "LlamaText"
});

type LlamaTextConstructor = Omit<typeof LlamaText, "prototype"> & {
    new (...values: readonly LlamaTextInputValue[]): LlamaText,
    (...values: readonly LlamaTextInputValue[]): LlamaText,
    readonly prototype: typeof LlamaText.prototype
};

const LlamaTextConstructor: LlamaTextConstructor = function LlamaText(this: LlamaText, ...values: readonly LlamaTextInputValue[]) {
    // this makes the constructor callable also as a normal function
    if (new.target == null)
        return new LlamaTextConstructor(...values);

    (this as Mutable<LlamaText>).values = createHistoryFromStringsAndValues(values);
    return this;
} as any;

(LlamaTextConstructor as (() => any)).prototype = Object.create(LlamaText.prototype);
(LlamaTextConstructor as (() => any)).prototype.constructor = LlamaTextConstructor;
LlamaTextConstructor.fromJSON = LlamaText.fromJSON;
LlamaTextConstructor.compare = LlamaText.compare;

const _LlamaText = LlamaTextConstructor;
type _LlamaText = LlamaText;

export {
    _LlamaText as LlamaText,
    LlamaText as _LlamaText
};

export class SpecialTokensText {
    public readonly value: string;

    public constructor(value: string) {
        this.value = value;
    }

    public toString() {
        return this.value;
    }

    public tokenize(tokenizer: Tokenizer, trimLeadingSpace: boolean = false): Token[] {
        return tokenizer(this.value, true, trimLeadingSpace ? "trimLeadingSpace" : undefined);
    }

    public tokenizeSpecialTokensOnly(tokenizer: Tokenizer): (string | Token)[] {
        const tokens = this.tokenize(tokenizer, true);
        const res: (string | Token)[] = [];
        let currentText = "";

        for (const token of tokens) {
            if (tokenizer.isSpecialToken(token)) {
                if (currentText !== "") {
                    res.push(currentText);
                    currentText = "";
                }

                res.push(token);
            } else {
                currentText += tokenizer.detokenize([token], false);
            }
        }

        if (currentText !== "")
            res.push(currentText);

        return res;
    }

    public toJSON(): LlamaTextSpecialTokensTextJSON {
        return {
            type: "specialTokensText",
            value: this.value
        };
    }

    /** @internal */
    public [Symbol.for("nodejs.util.inspect.custom")](
        depth: number | null, inspectOptions: InspectOptions, inspect: typeof InspectFunction
    ) {
        return "new SpecialTokensText(" + inspect(this.value, {
            ...(inspectOptions ?? {}),
            depth: depth == null
                ? undefined
                : Math.max(0, depth - 1)
        }) + ")";
    }

    public static fromJSON(json: LlamaTextSpecialTokensTextJSON): SpecialTokensText {
        if (SpecialTokensText.isSpecialTokensTextJSON(json))
            return new SpecialTokensText(json.value);

        throw new Error(`Invalid JSON for SpecialTokensText: ${JSON.stringify(json)}`);
    }

    public static isSpecialTokensTextJSON(value: LlamaTextJSONValue): value is LlamaTextSpecialTokensTextJSON {
        return value != null && typeof value === "object" && value.type === "specialTokensText";
    }

    /**
     * Wraps the value with a `SpecialTokensText` only if `shouldWrap` is true
     */
    public static wrapIf(shouldWrap: boolean, value: string): SpecialTokensText | string {
        if (shouldWrap)
            return new SpecialTokensText(value);
        else
            return value;
    }
}

export type BuiltinSpecialTokenValue = "BOS" | "EOS" | "NL" | "EOT";
export class SpecialToken {
    public readonly value: BuiltinSpecialTokenValue;

    public constructor(value: BuiltinSpecialTokenValue) {
        this.value = value;
    }

    public toString() {
        return this.value;
    }

    public tokenize(tokenizer: Tokenizer): Token[] {
        return tokenizer(this.value, "builtin");
    }

    public toJSON(): LlamaTextSpecialTokenJSON {
        return {
            type: "specialToken",
            value: this.value
        };
    }

    /** @internal */
    public [Symbol.for("nodejs.util.inspect.custom")](
        depth: number | null, inspectOptions: InspectOptions, inspect: typeof InspectFunction
    ) {
        return "new SpecialToken(" + inspect(this.value, {
            ...(inspectOptions ?? {}),
            depth: depth == null
                ? undefined
                : Math.max(0, depth - 1)
        }) + ")";
    }

    public static fromJSON(json: LlamaTextSpecialTokenJSON): SpecialToken {
        if (SpecialToken.isSpecialTokenJSON(json))
            return new SpecialToken(json.value as BuiltinSpecialTokenValue);

        throw new Error(`Invalid JSON for SpecialToken: ${JSON.stringify(json)}`);
    }

    public static isSpecialTokenJSON(value: LlamaTextJSONValue): value is LlamaTextSpecialTokenJSON {
        return value != null && typeof value === "object" && value.type === "specialToken";
    }
}

export function isLlamaText(value: unknown): value is LlamaText {
    if (value instanceof LlamaTextConstructor || value instanceof LlamaText)
        return true;

    // detect a `LlamaText` created from a different module import
    return value != null && Object.getPrototypeOf(value as LlamaText)?._type === "LlamaText";
}

export function tokenizeText(text: string | LlamaText, tokenizer: Tokenizer) {
    if (typeof text === "string")
        return tokenizer(text, false);
    else
        return text.tokenize(tokenizer);
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

function createHistoryFromStringsAndValues(values: readonly LlamaTextInputValue[]): readonly LlamaTextValue[] {
    function addItemToRes(res: LlamaTextValue[], item: LlamaTextInputValue): LlamaTextValue[] {
        if (item === undefined || item === "" || (item instanceof SpecialTokensText && item.value === ""))
            return res;
        else if (typeof item === "string" || item instanceof SpecialTokensText || item instanceof SpecialToken) {
            res.push(item);
            return res;
        } else if (isLlamaText(item)) {
            for (const value of item.values)
                res.push(value);

            return res;
        } else if (item instanceof Array) {
            for (const value of item) {
                if (isLlamaText(value)) {
                    for (const innerValue of value.values)
                        res.push(innerValue);
                } else if (value === "" || (value instanceof SpecialTokensText && value.value === ""))
                    continue;
                else if (value instanceof Array)
                    addItemToRes(res, value);
                else if (typeof value === "number" || typeof value === "boolean")
                    res.push(String(value));
                else
                    res.push(value);
            }

            return res;
        } else if (typeof item === "number" || typeof item === "boolean") {
            res.push(String(item));
            return res;
        }

        return item satisfies never;
    }

    function squashAdjacentItems(res: LlamaTextValue[], item: LlamaTextValue) {
        if (res.length === 0) {
            res.push(item);
            return res;
        }

        const lastItem = res[res.length - 1];

        if (lastItem instanceof SpecialToken || item instanceof SpecialToken) {
            res.push(item);
            return res;
        }

        if (typeof lastItem === "string" && typeof item === "string") {
            res[res.length - 1] += item;
            return res;
        } else if (lastItem instanceof SpecialTokensText && item instanceof SpecialTokensText) {
            res[res.length - 1] = new SpecialTokensText(lastItem.value + item.value);
            return res;
        }

        res.push(item);
        return res;
    }

    return values
        .reduce(addItemToRes, [])
        .reduce(squashAdjacentItems, []);
}

function compareLlamaTextValues(a: LlamaTextValue, b: LlamaTextValue) {
    if (a instanceof SpecialTokensText && b instanceof SpecialTokensText)
        return a.value === b.value;
    else if (a instanceof SpecialToken && b instanceof SpecialToken)
        return a.value === b.value;
    else if (a !== b)
        return false;

    return true;
}
