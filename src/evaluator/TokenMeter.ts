/**
 * Tracks the evaluation usage of tokens.
 */
export class TokenMeter {
    private _inputTokens: number = 0;
    private _outputTokens: number = 0;
    private _restoreStateTokens: number = 0;

    /**
     * The number of input tokens used
     */
    public get usedInputTokens() {
        return this._inputTokens;
    }

    /**
     * The number of tokens generated by a model
     */
    public get usedOutputTokens() {
        return this._outputTokens;
    }

    /**
     * The number of tokens used as input to restore a context sequence state to continue previous evaluation.
     * This may be consumed by virtual context sequences.
     */
    public get usedRestoreStateTokens() {
        return this._restoreStateTokens;
    }

    /**
     * Get the current state of the token meter
     */
    public getState(): TokenMeterState {
        return {
            usedInputTokens: this.usedInputTokens,
            usedOutputTokens: this.usedOutputTokens,
            usedRestoreStateTokens: this.usedRestoreStateTokens
        };
    }

    /**
     * Log the usage of tokens
     */
    public useTokens(tokens: number, type: "input" | "output" | "restoreState") {
        if (tokens < 0)
            throw new RangeError("Tokens cannot be negative");
        else if (tokens === 0)
            return;

        if (type === "input")
            this._inputTokens += tokens;
        else if (type === "output")
            this._outputTokens += tokens;
        else if (type === "restoreState")
            this._restoreStateTokens += tokens;
        else {
            void (type satisfies never);
            throw new TypeError(`Unknown token type: ${type}`);
        }
    }

    /**
     * Get the difference between the current meter and another meter
     */
    public diff(meter: TokenMeter | TokenMeterState) {
        return TokenMeter.diff(this, meter);
    }

    /**
     * Log the usage of tokens on multiple meters
     */
    public static useTokens(
        meters: null | undefined | TokenMeter | readonly TokenMeter[] | ReadonlySet<TokenMeter>,
        tokens: number,
        type: "input" | "output" | "restoreState"
    ) {
        if (meters == null)
            return;

        if (meters instanceof TokenMeter)
            meters.useTokens(tokens, type);
        else {
            for (const meter of meters)
                meter.useTokens(tokens, type);
        }
    }

    /**
     * Get the difference between two meters
     */
    public static diff(
        meter1: TokenMeter | TokenMeterState,
        meter2: TokenMeter | TokenMeterState
    ) {
        return {
            usedInputTokens: meter1.usedInputTokens - meter2.usedInputTokens,
            usedOutputTokens: meter1.usedOutputTokens - meter2.usedOutputTokens,
            usedRestoreStateTokens: meter1.usedRestoreStateTokens - meter2.usedRestoreStateTokens
        };
    }
}

export type TokenMeterState = {
    usedInputTokens: number,
    usedOutputTokens: number,
    usedRestoreStateTokens: number
};
