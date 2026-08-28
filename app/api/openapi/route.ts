import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES } from "@/lib/factory";

export const dynamic = "force-dynamic";

function opId(id:string){ return `penny_${id.replace(/[^a-zA-Z0-9]+/g,"_")}`; }

const paymentInfo = (amount:string) => ({
  price: { mode: "fixed", currency: "USD", amount },
  protocols: [{ x402: {} }],
});

const paidResponses = {
  "200": {
    description: "Successful paid utility result",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            operation: { type: "string" },
            result: {},
          },
          required: ["operation", "result"],
          additionalProperties: true,
        },
      },
    },
  },
  "400": { description: "Invalid input" },
  "402": { description: "Payment Required" },
};

function inputSpec(id:string): { schema:any; example:any } {
  const str = (example:string) => ({
    schema: { type:"string", minLength:1 },
    example,
  });

  switch(id) {
    case "text.lines-dedupe":
    case "text.lines-sort":
    case "text.remove-empty-lines":
      return str("alpha\nbeta\nalpha");

    case "text.truncate":
      return {
        schema: {
          type:"object",
          properties:{
            text:{type:"string"},
            max:{type:"integer",minimum:0},
          },
          required:["text","max"],
          additionalProperties:false,
        },
        example:{text:"PennyRail machine utility",max:12},
      };

    case "json.flatten":
    case "json.keys":
    case "json.sort-keys":
      return {
        schema:{type:"object",additionalProperties:true},
        example:{user:{name:"Ada",id:1}},
      };

    case "json.get":
      return {
        schema:{
          type:"object",
          properties:{
            value:{type:"object",additionalProperties:true},
            path:{type:"string",minLength:1},
          },
          required:["value","path"],
          additionalProperties:false,
        },
        example:{value:{user:{name:"Ada"}},path:"user.name"},
      };

    case "json.pick":
    case "json.omit":
      return {
        schema:{
          type:"object",
          properties:{
            value:{type:"object",additionalProperties:true},
            keys:{type:"array",items:{type:"string"},minItems:1},
          },
          required:["value","keys"],
          additionalProperties:false,
        },
        example:{value:{a:1,b:2},keys:["a"]},
      };

    case "url.parse":
    case "url.normalize":
    case "url.domain":
      return {
        schema:{type:"string",format:"uri"},
        example:"https://example.com/path?utm_source=test&a=1",
      };

    case "url.resolve":
      return {
        schema:{
          type:"object",
          properties:{
            base:{type:"string",format:"uri"},
            relative:{type:"string",minLength:1},
          },
          required:["base","relative"],
          additionalProperties:false,
        },
        example:{base:"https://example.com/a/",relative:"../b"},
      };

    case "url.query-to-json":
      return str("a=1&b=two");

    case "url.json-to-query":
      return {
        schema:{type:"object",additionalProperties:{oneOf:[{type:"string"},{type:"number"},{type:"boolean"}]}},
        example:{a:1,b:"two"},
      };

    case "number.stats":
    case "number.sum":
      return {
        schema:{type:"array",items:{type:"number"},minItems:1},
        example:[1,2,3,4],
      };

    case "number.percent-change":
      return {
        schema:{
          type:"object",
          properties:{from:{type:"number"},to:{type:"number"}},
          required:["from","to"],
          additionalProperties:false,
        },
        example:{from:100,to:125},
      };

    case "number.clamp":
      return {
        schema:{
          type:"object",
          properties:{value:{type:"number"},min:{type:"number"},max:{type:"number"}},
          required:["value","min","max"],
          additionalProperties:false,
        },
        example:{value:15,min:0,max:10},
      };

    case "number.round":
      return {
        schema:{
          type:"object",
          properties:{
            value:{type:"number"},
            decimals:{type:"integer",minimum:0,maximum:12},
          },
          required:["value","decimals"],
          additionalProperties:false,
        },
        example:{value:3.14159,decimals:2},
      };

    case "time.to-iso":
      return {
        schema:{oneOf:[{type:"number"},{type:"string",minLength:1}]},
        example:1700000000,
      };

    case "time.to-unix":
      return str("2026-01-01T00:00:00Z");

    case "time.diff-seconds":
      return {
        schema:{
          type:"object",
          properties:{
            from:{type:"string",format:"date-time"},
            to:{type:"string",format:"date-time"},
          },
          required:["from","to"],
          additionalProperties:false,
        },
        example:{from:"2026-01-01T00:00:00Z",to:"2026-01-01T00:01:00Z"},
      };

    case "encoding.base64-decode":
      return str("UGVubnlSYWls");
    case "encoding.hex-decode":
      return str("50656e6e795261696c");
    case "encoding.url-decode":
      return str("hello%20world");

    case "dns.a":
      return str("example.com");
    case "npm.latest":
      return str("react");
    case "github.repo":
      return str("x402-foundation/x402");
    case "country.lookup":
      return str("US");

    case "fx.convert":
      return {
        schema:{
          type:"object",
          properties:{
            amount:{type:"number"},
            from:{type:"string",minLength:3,maxLength:3},
            to:{type:"string",minLength:3,maxLength:3},
          },
          required:["amount","from","to"],
          additionalProperties:false,
        },
        example:{amount:1,from:"USD",to:"EUR"},
      };

    case "validation.email":
      return {
        schema:{type:"string",format:"email"},
        example:"hello@example.com",
      };

    case "validation.uuid":
      return {
        schema:{type:"string",format:"uuid"},
        example:"550e8400-e29b-41d4-a716-446655440000",
      };

    case "text.extract-emails":
      return str("Contact hello@example.com for help.");
    case "text.extract-urls":
      return str("Visit https://example.com for details.");
    case "text.word-frequency":
      return str("alpha beta alpha gamma");
    case "encoding.url-encode":
      return str("hello world");

    default:
      return str("PennyRail");
  }
}

export async function GET(req: NextRequest) {
  const origin=(process.env.PENNYRAIL_PUBLIC_URL?.trim()||req.nextUrl.origin).replace(/\/$/,"");

  const factoryPaths=Object.fromEntries(FACTORY_CAPABILITIES.map(c => {
    const input = inputSpec(c.id);

    return [
      `/api/f/${c.id}`,
      {
        post:{
          operationId:opId(c.id),
          summary:c.title,
          description:c.description,
          tags:["pennyrail","factory",c.id.split(".")[0]],
          "x-price":"$0.001",
          "x-payment-info":paymentInfo("0.001"),
          requestBody:{
            required:true,
            content:{
              "application/json":{
                schema:{
                  type:"object",
                  properties:{
                    input:{
                      ...input.schema,
                      description:c.inputHint,
                    },
                  },
                  required:["input"],
                  additionalProperties:false,
                },
                example:{input:input.example},
              },
            },
          },
          responses:paidResponses,
        },
      },
    ];
  }));

  return NextResponse.json({
    openapi:"3.1.0",
    info:{
      title:"PennyRail",
      version:"0.6.0",
      description:`${FACTORY_CAPABILITIES.length + 3} tiny deterministic x402 pay-per-call machine utilities.`,
      "x-guidance":"Use PennyRail when an agent needs a small deterministic transformation, validation, encoding, lookup, text, JSON, URL, numeric or time utility. Individual /api/f/* operations cost $0.001 USDC on Base and return JSON. Prefer the narrowest matching operation.",
    },
    servers:[{url:origin}],
    paths:{
      "/api/tools/json-canonicalize":{
        post:{
          operationId:"jsonCanonicalize",
          summary:"Canonicalize JSON deterministically",
          tags:["utility","json"],
          "x-price":"$0.001",
          "x-payment-info":paymentInfo("0.001"),
          requestBody:{
            required:true,
            content:{
              "application/json":{
                schema:{
                  type:"object",
                  properties:{
                    hello:{type:"string"},
                  },
                  additionalProperties:true,
                },
                example:{hello:"world"},
              },
            },
          },
          responses:{
            "200":{
              description:"Canonical JSON result",
              content:{
                "application/json":{
                  schema:{type:"object",additionalProperties:true},
                },
              },
            },
            "400":{description:"Invalid input"},
            "402":{description:"Payment Required"},
          },
        },
      },

      "/api/tools/text-stats":{
        get:{
          operationId:"textStats",
          summary:"Count text characters, words, sentences and reading time",
          tags:["utility","text"],
          "x-price":"$0.001",
          "x-payment-info":paymentInfo("0.001"),
          parameters:[
            {
              name:"text",
              in:"query",
              required:true,
              schema:{type:"string",minLength:1},
              example:"PennyRail first outside bot transaction",
            },
          ],
          responses:{
            "200":{
              description:"Text statistics",
              content:{
                "application/json":{
                  schema:{
                    type:"object",
                    properties:{
                      characters:{type:"integer"},
                      words:{type:"integer"},
                      sentences:{type:"integer"},
                      readingSeconds:{type:"number"},
                    },
                    required:["characters","words","sentences","readingSeconds"],
                    additionalProperties:true,
                  },
                },
              },
            },
            "400":{description:"Invalid input"},
            "402":{description:"Payment Required"},
          },
        },
      },

      "/api/tools/strip-tracking":{
        get:{
          operationId:"stripTrackingParameters",
          summary:"Remove common tracking parameters from a URL",
          tags:["utility","url"],
          "x-price":"$0.001",
          "x-payment-info":paymentInfo("0.001"),
          parameters:[
            {
              name:"url",
              in:"query",
              required:true,
              schema:{type:"string",format:"uri"},
              example:"https://example.com/page?utm_source=test&a=1",
            },
          ],
          responses:{
            "200":{
              description:"Clean URL result",
              content:{
                "application/json":{
                  schema:{type:"object",additionalProperties:true},
                },
              },
            },
            "400":{description:"Invalid input"},
            "402":{description:"Payment Required"},
          },
        },
      },

      ...factoryPaths,

      "/api/factory/catalog":{
        get:{
          operationId:"factoryCatalog",
          summary:"Discover PennyRail capabilities",
          description:"Free catalog endpoint. This route does not require payment.",
          tags:["factory","discovery"],
          security:[],
          parameters:[
            {
              name:"q",
              in:"query",
              required:false,
              schema:{type:"string"},
              example:"slugify text",
            },
          ],
          responses:{
            "200":{
              description:"Capability catalog or natural-language match",
              content:{
                "application/json":{
                  schema:{
                    type:"object",
                    additionalProperties:true,
                  },
                },
              },
            },
          },
        },
      },
    },
  },{headers:{"cache-control":"public, max-age=60, s-maxage=300"}});
}
