import {describe, expect, test} from "vitest";
import {LlamaChatSession, LlamaJsonSchemaGrammar} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("functionary", () => {
    describe("grammar", () => {
        describe("JSON schema", () => {
            test("find verb in message", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });
                const chatSession = new LlamaChatSession({
                    contextSequence: context.getSequence()
                });

                const grammar = new LlamaJsonSchemaGrammar(llama, {
                    type: "object",
                    properties: {
                        "userMessagePositivityScoreFromOneToTen": {
                            enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                        },
                        "verbsInUserMessage": {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        }
                    }
                } as const);

                const res = await chatSession.prompt("How's your great day going so far?", {
                    grammar
                });
                const parsedRes = grammar.parse(res);

                expect(parsedRes.userMessagePositivityScoreFromOneToTen).to.eq(10);
                expect(parsedRes.verbsInUserMessage).to.eql(["going"]);
            });

            test("get an array of numbers", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("functionary-small-v2.2.q4_0.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });
                const chatSession = new LlamaChatSession({
                    contextSequence: context.getSequence()
                });

                const grammar = new LlamaJsonSchemaGrammar(llama, {
                    type: "array",
                    items: {
                        type: "number"
                    }
                } as const);

                const res = await chatSession.prompt("Give me an array of numbers from 1 to 10", {
                    grammar
                });
                const parsedRes = grammar.parse(res);

                expect(parsedRes).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            });
        });
    });
});
