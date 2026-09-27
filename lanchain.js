import "dotenv/config";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import {
    StateGraph,
    Annotation,
    START,
    END
} from "@langchain/langgraph";

const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3.6-flash",
    temperature: 0
});

const State = Annotation.Root({
    request:Annotation(),
    opeartion:Annotation()
});

const add = tool(
    async ({ a, b }) => {
        return a + b;
    },
    {
        name: "add",
        description: "Add two numbers",
        schema: z.object({
            a: z.number(),
            b: z.number()
        })
    }
);

const multiply = tool(
    async ({ a, b }) => {
        return a * b;
    },
    {
        name: "multiply",
        description: "Multiply two numbers",
        schema: z.object({
            a: z.number(),
            b: z.number()
        })
    }
);

const llmWithTools = llm.bindTools([add, multiply]);

const findTool = async (state) => {

    const prompt = ChatPromptTemplate.fromMessages([
        [
            "system",
            `You are an AI assistant.
Use one of the available tools if the user's request requires
addition or multiplication.`
        ],
        ["human", "{request}"]
    ]);

    const chain = prompt.pipe(llmWithTools);

    const response = await chain.invoke({
        request: state.message
    });

    return {
        operation: response.tool_calls
    };
};

const toolCall = async (state) => {

    const toolCall = state.operation[0];
    let output;

    if (toolCall.name === "add") {

        output = await add.invoke(toolCall.args);

    } else if (toolCall.name === "multiply") {

        output = await multiply.invoke(toolCall.args);

    } else {

        output = "No tool required";
    }

    return {
        output
    };
};
const route = (state) =>{
    if(state.opeartion.length !=0){
        return "toolCall";
    }else{
        return "noTool";
    }
}

const graph = new StateGraph(State);

graph.addNode("findTool", findTool);
graph.addNode("toolCall", toolCall);

graph.addEdge(START, "findTool");
graph.addConditionalEdges(
    "findTool",
    route,
    {
        toolCall:"toolCall",
        noTool:"noTool"
    }
)
graph.addEdge("toolCall","findTool")
graph.addEdge("noTool" ,END);

const app = graph.compile();

const response = await app.invoke({
    request: "divide 2 and 3"
});

console.log(response.output);