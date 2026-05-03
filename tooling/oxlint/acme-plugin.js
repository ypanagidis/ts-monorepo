const processEnvMessage =
  "Use `import { env } from '~/env'` instead to ensure validated types.";

const isProcessEnvAccess = (node) => {
  if (node.type !== "MemberExpression") return false;
  if (node.object?.type !== "Identifier" || node.object.name !== "process") {
    return false;
  }

  if (!node.computed) {
    return node.property?.type === "Identifier" && node.property.name === "env";
  }

  return node.property?.type === "Literal" && node.property.value === "env";
};

export default {
  rules: {
    "no-process-env": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow direct process.env access outside env modules.",
        },
        messages: {
          restricted: processEnvMessage,
        },
        schema: [],
      },
      create(context) {
        return {
          MemberExpression(node) {
            if (!isProcessEnvAccess(node)) return;
            context.report({
              node,
              messageId: "restricted",
            });
          },
        };
      },
    },
  },
};
