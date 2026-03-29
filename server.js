{
  "name": "Gestor Total de Gmail (Personal) PRO",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "86651dd0-dec6-4828-afbe-561d76c3ea16-pro",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "6e439b14-4793-4e07-bc65-9ecc570ba9d8",
      "name": "Webhook Entrada",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        -1728,
        896
      ],
      "webhookId": "86651dd0-dec6-4828-afbe-561d76c3ea16-pro"
    },
    {
      "parameters": {
        "jsCode": "const body = $input.first().json.body || $input.first().json || {};\nconst text = body.text || body.input || body.query || body.content || '';\nconst autoSend = body.autoSend === true;\nconst confirmed = body.confirmed === true;\nconst to = body.to || '';\nconst subject = body.subject || '';\nconst content = body.content || '';\nconst emailId = body.emailId || '';\nconst threadId = body.threadId || '';\nconst labelName = body.labelName || body.label || '';\nconst labelId = body.labelId || '';\nconst sendAt = body.sendAt || body.scheduleAt || '';\nconst timezone = body.timezone || 'Europe/Madrid';\nconst account = body.account || 'personal';\n\nreturn [{\n  json: {\n    raw_body: body,\n    text,\n    autoSend,\n    confirmed,\n    to,\n    subject,\n    content,\n    emailId,\n    threadId,\n    labelName,\n    labelId,\n    sendAt,\n    timezone,\n    account\n  }\n}];"
      },
      "id": "222febfb-b365-4def-a0da-ce2c3d13cae0",
      "name": "Parsear Petición",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1504,
        896
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "=REGLA ABSOLUTA: Si el usuario menciona \"elimina\", \"borra\", \"quita\" o \"suprime\" → action SIEMPRE es \"eliminar_uno\" o \"eliminar_lote\". NUNCA \"listar\".\nEres un planificador experto de Gmail. Tu única función es convertir la petición del usuario en JSON válido.\nCRÍTICO: Devuelve ÚNICAMENTE el objeto JSON. Sin texto antes, sin texto después, sin bloques markdown, sin explicaciones.\nEsquema de respuesta:\n{\n  \"action\": \"listar|buscar|leer_especifico|leer_completo|priorizar|eliminar_uno|eliminar_lote|archivar_lote|marcar_leido_lote|marcar_no_leido_lote|spam_lote|mover_label_lote|redactar|enviar|responder|programar_envio\",\n  \"query\": \"consulta Gmail search sintaxis nativa\",\n  \"targetHint\": \"nombre, email o asunto si aplica\",\n  \"emailId\": \"si el usuario lo proporcionó explícitamente\",\n  \"to\": \"destinatario si aplica\",\n  \"subject\": \"asunto si aplica\",\n  \"content\": \"contenido/instrucciones del email si aplica\",\n  \"labelName\": \"nombre etiqueta si aplica\",\n  \"labelId\": \"id etiqueta si aplica\",\n  \"sendAt\": \"fecha ISO 8601 si aplica\",\n  \"limit\": 10,\n  \"autoSend\": true,\n  \"reason\": \"una frase breve explicando la acción elegida\"\n}\nReglas de mapeo de acciones:\n- \"borra/elimina todos...\" → eliminar_lote\n- \"borra/elimina este/ese/el de X\" (uno solo) → eliminar_uno (usa emailId si disponible, sino targetHint)\n- \"purga/elimina para siempre/permanente...\" → eliminar_lote (y en originalText quedará la intención de purgar)\n- \"archiva...\" → archivar_lote\n- \"marca como leído...\" → marcar_leido_lote\n- \"marca como no leído...\" → marcar_no_leido_lote\n- \"marca como spam/correo no deseado...\" → spam_lote\n- \"mueve a la etiqueta/carpeta...\" → mover_label_lote\n- \"léeme el email de X / léeme el de X\" → leer_especifico\n- \"léeme completo / muéstrame todo...\" → leer_completo\n- \"responde a...\" → responder\n- \"envía un email a...\" → enviar\n- \"programa/enviar más tarde...\" → programar_envio\n- \"prioriza/clasifica/ordena por importancia...\" → priorizar\n- \"muéstrame/lista/dame los emails...\" → listar\n- \"busca emails de/sobre/con...\" → buscar\n- \"redacta/escribe un email...\" → redactar\nReglas de query Gmail:\n- Sin query clara para listar/priorizar → usa \"in:inbox\"\n- Remitente → from:email@ejemplo.com\n- Asunto → subject:\"texto\"\n- Antes de fecha → before:YYYY/MM/DD\n- Después de fecha → after:YYYY/MM/DD\n- No leídos → is:unread\n- Marketing/promociones → category:promotions\n- Con adjunto → has:attachment\nautoSend debe respetar exactamente el valor de {{$json.autoSend}}.\nSi ya viene emailId en los datos adicionales, úsalo directamente.\nINPUT DEL USUARIO:\n{{$json.text}}\nDATOS ADICIONALES (usar si el usuario no los especificó explícitamente en el texto):\nto={{$json.to}}\nsubject={{$json.subject}}\ncontent={{$json.content}}\nemailId={{$json.emailId}}\nlabelName={{$json.labelName}}\nlabelId={{$json.labelId}}\nsendAt={{$json.sendAt}}\nautoSend={{$json.autoSend}}\n\nEJEMPLOS CRÍTICOS (sigue estos exactamente):\n- \"elimina el de Just Eat\" → {\"action\":\"eliminar_uno\",\"targetHint\":\"Just Eat\",\"query\":\"from:just-eat\",\"limit\":5}\n- \"borra ese correo\" → {\"action\":\"eliminar_uno\",\"targetHint\":\"email anterior\",\"query\":\"in:inbox\",\"limit\":5}\n- \"elimina el primero de la lista\" → {\"action\":\"eliminar_uno\",\"targetHint\":\"primer email\",\"query\":\"in:inbox\",\"limit\":5}\n- \"borra todos los de promotions\" → {\"action\":\"eliminar_lote\",\"query\":\"category:promotions\",\"limit\":50}\n- \"elimina el correo de pinterest que me has mencionado\" → {\"action\":\"eliminar_uno\",\"targetHint\":\"pinterest\",\"query\":\"from:pinterest\",\"limit\":5}\n\nJSON:"
      },
      "id": "8b49a40f-5ea1-4c5f-b5b2-12cf2d7df96b",
      "name": "IA Planificar Acción",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        -1328,
        896
      ]
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "claude-sonnet-4-20250514",
          "mode": ""
        },
        "options": {}
      },
      "id": "34c1bd73-45eb-4ee1-8f9e-99b436e66448",
      "name": "Modelo IA Planificador",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        -1264,
        736
      ],
      "credentials": {
        "anthropicApi": {
          "id": "MRjeQ5orOy0YoqbT",
          "name": "Anthropic account"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const raw = $input.first().json.text || $input.first().json.output || $input.first().json.response || '';\nconst base = $('Parsear Petición').item.json;\nlet plan;\n\ntry {\n  let toParse = String(raw).trim();\n  // Strip markdown fences if model ignores the instruction\n  toParse = toParse.replace(/^```json\\s*/i, '').replace(/^```\\s*/i, '').replace(/\\s*```$/i, '').trim();\n  // Extract JSON object if there's text around it\n  const jsonMatch = toParse.match(/\\{[\\s\\S]*\\}/);\n  if (jsonMatch) toParse = jsonMatch[0];\n  plan = JSON.parse(toParse);\n} catch (e) {\n  throw new Error(`IA devolvió JSON inválido: ${String(raw).substring(0, 200)}`);\n}\n\n// Validate action\nconst validActions = ['listar','buscar','leer_especifico','leer_completo','priorizar',\n  'eliminar_uno','eliminar_lote','archivar_lote','marcar_leido_lote','marcar_no_leido_lote',\n  'spam_lote','mover_label_lote','redactar','enviar','responder','programar_envio'];\n\nconst action = plan.action && validActions.includes(plan.action) ? plan.action : 'buscar';\n\nconst normalized = {\n  action,\n  query: plan.query || '',\n  targetHint: plan.targetHint || '',\n  emailId: plan.emailId || base.emailId || '',\n  to: plan.to || base.to || '',\n  subject: plan.subject || base.subject || '',\n  content: plan.content || base.content || '',\n  labelName: plan.labelName || base.labelName || '',\n  labelId: plan.labelId || base.labelId || '',\n  sendAt: plan.sendAt || base.sendAt || '',\n  limit: Math.min(Math.max(Number(plan.limit) || 10, 1), 100),\n  autoSend: typeof plan.autoSend === 'boolean' ? plan.autoSend : base.autoSend,\n  reason: plan.reason || '',\n  confirmed: base.confirmed === true || plan.confirmed === true,\n  originalText: base.text,\n  timezone: base.timezone,\n  account: base.account\n};\n\n// Default queries\nif (!normalized.query && ['listar','buscar','priorizar'].includes(normalized.action)) {\n  normalized.query = 'in:inbox';\n}\nif (!normalized.query && ['leer_especifico','leer_completo','eliminar_lote','archivar_lote',\n    'marcar_leido_lote','marcar_no_leido_lote','spam_lote','mover_label_lote'].includes(normalized.action)) {\n  normalized.query = normalized.targetHint || normalized.emailId || 'in:inbox';\n}\n\nreturn [{ json: normalized }];"
      },
      "id": "c456f0d0-3d96-4065-ac14-26607b7b2ef8",
      "name": "Parsear Plan IA",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1024,
        896
      ]
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "listar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "08bd2657-36e2-4a1c-b942-3bdd0a9b748c"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "listar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "buscar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "af1e0974-9b83-445d-8c64-e2d6428435b3"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "buscar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "leer_especifico",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "db3f9eb0-9415-448c-8dd7-4ff583898adb"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "leer_especifico"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "leer_completo",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "ab153963-9ac5-451c-a42a-b46b243342aa"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "leer_completo"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "priorizar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "a3e25753-2ef8-48ec-b67f-1b45ac2250fb"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "priorizar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "eliminar_uno",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "ca35280e-f84a-4583-a6a0-185f7868626a"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "eliminar_uno"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "eliminar_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "85cb30a2-99ac-4b17-a6c9-5e9781adeb71"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "eliminar_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "archivar_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "6d4575fc-4b03-41f4-bb71-90cb1a74763b"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "archivar_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "marcar_leido_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "f5943cd6-a666-4176-ab47-79ff745a1c17"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "marcar_leido_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "marcar_no_leido_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "7a083781-1909-408e-b75f-351334e8f502"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "marcar_no_leido_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "spam_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "25c219b8-7e9b-42b9-8eea-aa3995389144"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "spam_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "mover_label_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "46ac0c5b-fb4c-423e-9d6f-05c876810f1d"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "mover_label_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "redactar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "4308f94b-f96f-4c4b-835c-69b5766e3a88"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "redactar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "enviar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "1f8bd914-9e30-47a3-a6b0-76e02a8d1a8a"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "enviar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "responder",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "b3a70b6b-ee47-4d3a-b046-48dd7607b3ea"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "responder"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true,
                  "leftValue": "",
                  "typeValidation": "strict",
                  "version": 1
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "programar_envio",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    },
                    "id": "3a317fde-ca4a-4cc9-90b5-410db9cdc0c0"
                  }
                ],
                "combinator": "and"
              },
              "renameOutput": true,
              "outputKey": "programar_envio"
            }
          ]
        },
        "options": {
          "fallbackOutput": "extra"
        }
      },
      "id": "ab788f5d-8614-453b-9b49-bcd5aefdbfca",
      "name": "Router Inteligente",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [
        -784,
        896
      ]
    },
    {
      "parameters": {
        "operation": "getAll",
        "limit": "={{ $('Parsear Plan IA').item.json.limit || 10 }}",
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.query || 'is:unread in:inbox' }}"
        }
      },
      "id": "a51c1021-70d0-4765-aff3-ae3a8080cdcd",
      "name": "Gmail Buscar Para Listar",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -496,
        288
      ],
      "webhookId": "a6859d32-2472-40cc-bacd-faafe266d2ec",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "getAll",
        "limit": "={{ $('Parsear Plan IA').item.json.limit || 10 }}",
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.query }}"
        }
      },
      "id": "0cdfcb0b-ba40-4ed9-9ab2-c050ee3fa775",
      "name": "Gmail Buscar",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -496,
        480
      ],
      "webhookId": "13e28829-3963-4930-9819-3b2e946946e8",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "getAll",
        "limit": 20,
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.query || $('Parsear Plan IA').item.json.targetHint }}"
        }
      },
      "id": "637ec444-fee0-4f6a-bcb5-31163b90931f",
      "name": "Gmail Buscar Para Lectura",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -480,
        672
      ],
      "webhookId": "5d9e4f00-0686-451c-b5a8-07b566274fe2",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nconst emails = $input.all().map(i => i.json);\n\nif (!emails.length) {\n  return [{ json: { found: false, reason: 'No se encontraron emails', plan } }];\n}\n\nif (plan.emailId) {\n  const exact = emails.find(m => m.id === plan.emailId);\n  if (exact) {\n    return [{ json: { found: true, selected: exact,\n      candidates: [{ id: exact.id, from: exact.From || exact.from, subject: exact.Subject || exact.subject, date: exact.internalDate }] } }];\n  }\n}\n\nconst norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');\nconst hint = norm(plan.targetHint || plan.originalText || '');\n\nconst scored = emails.map((m) => {\n  const from    = norm(m.From    || m.from    || '');\n  const subject = norm(m.Subject || m.subject || '');\n  const snippet = norm(m.snippet || '');\n  let score = 0;\n  if (hint) {\n    const words = hint.split(/\\s+/).filter(w => w.length > 2);\n    for (const w of words) {\n      if (from.includes(w))    score += 10;\n      if (subject.includes(w)) score += 8;\n      if (snippet.includes(w)) score += 3;\n    }\n    if (from.includes(hint))    score += 5;\n    if (subject.includes(hint)) score += 4;\n  }\n  score += parseInt(m.internalDate || m.date || 0) / 1e13;\n  return { msg: m, score };\n}).sort((a, b) => b.score - a.score);\n\nreturn [{ json: {\n  found: true,\n  selected: scored[0].msg,\n  candidates: scored.slice(0, 5).map(s => ({\n    id: s.msg.id,\n    from: s.msg.From || s.msg.from,\n    subject: s.msg.Subject || s.msg.subject,\n    date: s.msg.internalDate\n  }))\n} }];"
      },
      "id": "deefe769-ec98-4c8a-939c-975f0e6159e1",
      "name": "Seleccionar Mejor Email",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -256,
        496
      ]
    },
    {
      "parameters": {
        "operation": "get",
        "messageId": "={{ $('Seleccionar Mejor Email').item.json.selected.id || $('Parsear Plan IA').item.json.emailId }}"
      },
      "id": "e3278024-7be8-421c-b200-fd573e696351",
      "name": "Gmail Obtener Email Completo",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        0,
        672
      ],
      "webhookId": "61051175-2eea-4336-82ec-6a340ac5b410",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const emails = $input.all();\n\nconst sorted = [...emails].sort((a, b) => {\n  const da = parseInt(a.json.internalDate || 0);\n  const db = parseInt(b.json.internalDate || 0);\n  return db - da;\n});\n\nconst formatDate = (ts) => {\n  if (!ts) return 'Sin fecha';\n  const d = new Date(parseInt(ts));\n  if (isNaN(d.getTime())) return String(ts);\n  return d.toLocaleString('es-ES', {\n    day: '2-digit', month: 'short', year: 'numeric',\n    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid'\n  });\n};\n\nconst getLabel = (labels, name) => Array.isArray(labels) && labels.some(l => l.id === name || l.name === name);\n\nconst emailList = sorted.map((e, i) => {\n  const m = e.json;\n  const from    = m.From    || m.from    || 'Desconocido';\n  const subject = m.Subject || m.subject || 'Sin asunto';\n  const date    = formatDate(m.internalDate || m.date);\n  const snippet = (m.snippet || '').substring(0, 200).trim();\n  const id      = m.id || '';\n  const unread  = getLabel(m.labels, 'UNREAD') ? ' 🔵' : '';\n  const attach  = getLabel(m.labels, 'HAS_ATTACHMENT') ? ' 📎' : '';\n  return `[${i+1}]${unread}${attach} ID:${id}\\nDe: ${from}\\nAsunto: ${subject}\\nFecha: ${date}\\nExtracto: ${snippet}`;\n}).join('\\n\\n---\\n\\n');\n\nreturn [{ json: { count: sorted.length, emailList } }];"
      },
      "id": "d41233f9-f376-4167-8363-f29b869a6f90",
      "name": "Formatear Emails",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -256,
        240
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Eres un asistente de email. Resume en español estos emails de forma clara, útil y concisa. Destaca los urgentes o importantes al principio. Sé directo, no repitas información obvia.\\n\\nEmails:\\n' + $json.emailList }}"
      },
      "id": "2c74fd05-7693-4549-9e97-1c5a1475afe7",
      "name": "IA Resumir Listado",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        -16,
        128
      ]
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "claude-sonnet-4-20250514",
          "mode": ""
        },
        "options": {}
      },
      "id": "434c9c80-b091-4ef4-89d6-7526ad9264c5",
      "name": "Modelo IA Resumen",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        0,
        0
      ],
      "credentials": {
        "anthropicApi": {
          "id": "MRjeQ5orOy0YoqbT",
          "name": "Anthropic account"
        }
      }
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Analiza y prioriza estos emails. Para cada uno indica:\\n- 🔴 ALTA / 🟡 MEDIA / 🟢 BAJA prioridad\\n- Motivo breve (1 línea)\\n- Acción recomendada (responder/archivar/ignorar/gestionar)\\n\\nEmails:\\n' + $json.emailList }}"
      },
      "id": "31ed85c2-a8c0-4620-9fb6-9585587b74a6",
      "name": "IA Priorizar Emails",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        16,
        480
      ]
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "claude-sonnet-4-20250514",
          "mode": ""
        },
        "options": {}
      },
      "id": "04b34d3b-5f14-4754-8db9-b14f59d35a3a",
      "name": "Modelo IA Priorizar",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        -16,
        320
      ],
      "credentials": {
        "anthropicApi": {
          "id": "MRjeQ5orOy0YoqbT",
          "name": "Anthropic account"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const msg = $input.first().json;\n\nconst from    = msg.From    || msg.from    || msg.payload?.headers?.find(h => h.name === 'From')?.value    || 'Desconocido';\nconst to      = msg.To      || msg.to      || msg.payload?.headers?.find(h => h.name === 'To')?.value      || '';\nconst subject = msg.Subject || msg.subject || msg.payload?.headers?.find(h => h.name === 'Subject')?.value || 'Sin asunto';\n\nconst formatDate = (ts) => {\n  if (!ts) return '';\n  const d = new Date(parseInt(ts));\n  return isNaN(d.getTime()) ? String(ts) : d.toLocaleString('es-ES', {\n    day: '2-digit', month: 'short', year: 'numeric',\n    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid'\n  });\n};\nconst date = formatDate(msg.internalDate) || msg.date || '';\n\nconst body = msg.textPlain\n  || msg.snippet\n  || (msg.textHtml ? msg.textHtml.replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim() : '')\n  || '';\n\nconst hasAttachments = msg.payload?.parts?.some(p => p.filename && p.filename.length > 0) || false;\n\nreturn [{\n  json: {\n    result: [\n      '📧 EMAIL COMPLETO',\n      '',\n      `De: ${from}`,\n      `Para: ${to}`,\n      `Asunto: ${subject}`,\n      `Fecha: ${date}`,\n      `ID: ${msg.id || ''}`,\n      msg.threadId ? `Thread: ${msg.threadId}` : '',\n      hasAttachments ? '📎 Tiene adjuntos' : '',\n      '',\n      '─'.repeat(50),\n      '',\n      String(body).substring(0, 8000)\n    ].filter(l => l !== '').join('\\n')\n  }\n}];"
      },
      "id": "9c7ce5c6-6fa1-40bb-9868-87e0047a1534",
      "name": "Construir Lectura Completa",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        512,
        480
      ]
    },
    {
      "parameters": {
        "operation": "getAll",
        "limit": 100,
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.query }}"
        }
      },
      "id": "f7f6db44-e9f0-46d3-b378-3f30a4a67922",
      "name": "Gmail Buscar Para Lote",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -464,
        1008
      ],
      "webhookId": "323e23c3-16fa-4099-99f2-faa58a640ed3",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "options": {}
      },
      "id": "c29056aa-9cd9-40c7-bc1b-d87eb1672486",
      "name": "Loop Lote",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [
        -256,
        1184
      ]
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.action }}",
                    "rightValue": "eliminar_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "eliminar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.action }}",
                    "rightValue": "archivar_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "archivar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.action }}",
                    "rightValue": "marcar_leido_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "marcar_leido"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.action }}",
                    "rightValue": "marcar_no_leido_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "marcar_no_leido"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.action }}",
                    "rightValue": "spam_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "spam"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.action }}",
                    "rightValue": "mover_label_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "mover_label"
            }
          ]
        },
        "options": {
          "fallbackOutput": "extra"
        }
      },
      "id": "5dfe5291-eccb-4cba-bcf9-a88ea51f1cf2",
      "name": "Router Lote",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [
        -96,
        1248
      ]
    },
    {
      "parameters": {
        "operation": "modify"
      },
      "id": "59c11136-fe2e-40da-aa51-f9b59294afb0",
      "name": "Gmail Mover a Papelera",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        192,
        976
      ],
      "webhookId": "2ed65a4c-5076-4326-b66d-348a0e8673d2",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "modify"
      },
      "id": "40e1d4be-8d4a-4fa1-83a6-84416b26be52",
      "name": "Gmail Archivar",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        368,
        1104
      ],
      "webhookId": "6d9a4295-f572-40c5-b273-f42a4b75c284",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "modify"
      },
      "id": "7f9c2541-517b-429d-9ca2-edc99bd57559",
      "name": "Gmail Marcar Leído",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        160,
        1184
      ],
      "webhookId": "3443c416-9ccc-4b3d-9235-6410a0ab9fcf",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "modify"
      },
      "id": "3472cef0-4d61-40f9-84a0-d7a1ccbe9b42",
      "name": "Gmail Marcar No Leído",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        560,
        1408
      ],
      "webhookId": "01e4320e-a55d-47ac-81ef-d89af08cee55",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "modify"
      },
      "id": "ea9eb7e9-8ccf-4807-93b5-c0ababffbc13",
      "name": "Gmail Marcar Spam",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        192,
        1376
      ],
      "webhookId": "a34d6be6-e1c4-46b3-a329-01fb4c62748a",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nconst customMap = {\n  trabajo: 'Label_TRABAJO_ID',\n  facturas: 'Label_FACTURAS_ID',\n  clientes: 'Label_CLIENTES_ID'\n};\n\nconst labelId = plan.labelId || customMap[String(plan.labelName || '').toLowerCase()] || '';\nif (!labelId) {\n  throw new Error('No se encontró labelId. Rellena labelId en la petición o actualiza customMap en el nodo Resolver Label.');\n}\nreturn [{ json: { ...$input.first().json, resolvedLabelId: labelId } }];"
      },
      "id": "165c6663-5bd5-43da-93d8-3efaf9f257f1",
      "name": "Resolver Label",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        160,
        1600
      ]
    },
    {
      "parameters": {
        "operation": "modify"
      },
      "id": "30e42759-a45f-45e6-b49a-1552db45a251",
      "name": "Gmail Mover a Label",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        560,
        1632
      ],
      "webhookId": "556e5448-2ad9-499c-a62e-3699b162e7d3",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nreturn [{\n  json: {\n    prompt: `Redacta un email profesional y natural en español.\\n\\nPara: ${plan.to}\\nAsunto: ${plan.subject}\\nInstrucciones: ${plan.content || plan.originalText}\\n\\nFirma como Adrián. Devuelve solo el cuerpo del email.`\n  }\n}];"
      },
      "id": "717b5c10-ac6c-4d77-84b5-32426db38f6d",
      "name": "Preparar Redacción",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -480,
        1488
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.prompt }}"
      },
      "id": "a65b72da-e63d-43b6-b3ad-04be6e0305e0",
      "name": "IA Redactar Email",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        -256,
        1632
      ]
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "claude-sonnet-4-20250514",
          "mode": ""
        },
        "options": {}
      },
      "id": "52ecec17-7655-4f4a-bff7-76318a99a08d",
      "name": "Modelo IA Redactar",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        -240,
        1760
      ],
      "credentials": {
        "anthropicApi": {
          "id": "MRjeQ5orOy0YoqbT",
          "name": "Anthropic account"
        }
      }
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.autoSend }}",
                    "rightValue": true,
                    "operator": {
                      "type": "boolean",
                      "operation": "true",
                      "singleValue": true
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "send"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.autoSend }}",
                    "rightValue": false,
                    "operator": {
                      "type": "boolean",
                      "operation": "false",
                      "singleValue": true
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "draft"
            }
          ]
        },
        "options": {
          "fallbackOutput": "extra"
        }
      },
      "id": "dd5f8b52-e701-4082-bfbe-a48c843d1319",
      "name": "¿Enviar Directamente?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [
        16,
        1696
      ]
    },
    {
      "parameters": {
        "sendTo": "={{ $('Parsear Plan IA').item.json.to }}",
        "subject": "={{ $('Parsear Plan IA').item.json.subject }}",
        "message": "={{ $json.text || $json.output || '' }}",
        "options": {}
      },
      "id": "1d99d32b-9a9f-405e-8ce3-67995803e87e",
      "name": "Gmail Enviar Redactado",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        336,
        1664
      ],
      "webhookId": "c542f7b3-7fd5-47b6-9420-a9bf1d13499a",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "return [{ json: { success: true, action: 'redactar', result: ($input.first().json.text || $input.first().json.output || ''), needsConfirmation: true } }];"
      },
      "id": "7b308651-5f96-4c7b-a55f-2f31b385d134",
      "name": "Devolver Borrador",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        336,
        1840
      ]
    },
    {
      "parameters": {
        "sendTo": "={{ $('Parsear Plan IA').item.json.to }}",
        "subject": "={{ $('Parsear Plan IA').item.json.subject }}",
        "message": "={{ $('Parsear Plan IA').item.json.content || $('Parsear Plan IA').item.json.originalText }}",
        "options": {}
      },
      "id": "d9257963-f330-4d67-a5fb-2e8a29fcd6cc",
      "name": "Gmail Enviar Directo",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -480,
        1760
      ],
      "webhookId": "a9c30941-8f40-4762-bea4-8e917b46a91f",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "get",
        "messageId": "={{ $('Parsear Plan IA').item.json.emailId || $('Seleccionar Mejor Email').item.json.selected.id }}"
      },
      "id": "1e9973cd-e9ae-41be-b1e6-7734460c8793",
      "name": "Gmail Obtener Para Responder",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -480,
        1984
      ],
      "webhookId": "90366e9a-36f2-479f-a870-49f49b0c2dab",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nconst email = $input.first().json;\nconst from = email.from || email.payload?.headers?.find(h => h.name === 'From')?.value || '';\nconst subject = email.subject || email.payload?.headers?.find(h => h.name === 'Subject')?.value || '';\nconst body = email.textPlain || email.snippet || '';\nconst replyTo = email.replyTo || email.payload?.headers?.find(h => h.name === 'Reply-To')?.value || from;\n\nreturn [{\n  json: {\n    prompt: `Redacta una respuesta profesional, natural y breve en español para este email.\\n\\nDe: ${from}\\nAsunto: ${subject}\\nContenido recibido: ${String(body).substring(0, 4000)}\\n\\nInstrucciones extra del usuario: ${plan.content || plan.originalText}\\n\\nFirma como Adrián. Devuelve solo el cuerpo de la respuesta.`,\n    replyToMessageId: email.id,\n    replyTo,\n    subject\n  }\n}];"
      },
      "id": "eb10db0e-3eee-4b23-bb22-90b36af2a304",
      "name": "Preparar Respuesta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -256,
        2000
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.prompt }}"
      },
      "id": "e8c8efee-9036-4096-a397-dc643f824839",
      "name": "IA Redactar Respuesta",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        -48,
        2016
      ]
    },
    {
      "parameters": {
        "model": {
          "__rl": true,
          "value": "claude-sonnet-4-20250514",
          "mode": ""
        },
        "options": {}
      },
      "id": "2e1107b9-1874-4808-b11e-102112a56a1c",
      "name": "Modelo IA Responder",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        -16,
        2160
      ],
      "credentials": {
        "anthropicApi": {
          "id": "MRjeQ5orOy0YoqbT",
          "name": "Anthropic account"
        }
      }
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": true
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.autoSend }}",
                    "rightValue": true,
                    "operator": {
                      "type": "boolean",
                      "operation": "true",
                      "singleValue": true
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "send"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": true
                },
                "conditions": [
                  {
                    "leftValue": "={{ $('Parsear Plan IA').item.json.autoSend }}",
                    "rightValue": false,
                    "operator": {
                      "type": "boolean",
                      "operation": "false",
                      "singleValue": true
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "draft"
            }
          ]
        },
        "options": {
          "fallbackOutput": "extra"
        }
      },
      "id": "7ce4419b-c15a-49e7-9b40-00a7fc9a683f",
      "name": "¿Enviar Respuesta Ya?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [
        256,
        2000
      ]
    },
    {
      "parameters": {
        "sendTo": "={{ $('Preparar Respuesta').item.json.replyTo || $('Gmail Obtener Para Responder').item.json.from || '' }}",
        "subject": "={{ 'Re: ' + ($('Preparar Respuesta').item.json.subject || '') }}",
        "message": "={{ $json.text || $json.output || '' }}",
        "options": {}
      },
      "id": "f5e4565f-cf66-41f3-87f9-ab364e0e7cec",
      "name": "Gmail Enviar Respuesta",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        512,
        1920
      ],
      "webhookId": "ce9b7f4f-0070-402f-8c17-1813594e779c",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "return [{ json: { success: true, action: 'responder', result: ($input.first().json.text || $input.first().json.output || ''), needsConfirmation: true } }];"
      },
      "id": "6326bc46-2e95-4748-8ce4-02f07114e3a7",
      "name": "Devolver Respuesta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        512,
        2080
      ]
    },
    {
      "parameters": {
        "resume": "specificTime",
        "dateTime": "={{ $('Parsear Plan IA').item.json.sendAt }}"
      },
      "id": "1d1f3bb6-aeab-4e87-9823-81dfcfd8fd04",
      "name": "Esperar Hasta Envío",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1.1,
      "position": [
        -480,
        2176
      ],
      "webhookId": "a691388a-830c-4898-85a4-8cb31de2a77c"
    },
    {
      "parameters": {
        "sendTo": "={{ $('Parsear Plan IA').item.json.to }}",
        "subject": "={{ $('Parsear Plan IA').item.json.subject }}",
        "message": "={{ $('Parsear Plan IA').item.json.content || $('Parsear Plan IA').item.json.originalText }}",
        "options": {}
      },
      "id": "121caed4-1122-4fe7-84d3-92a76187063c",
      "name": "Gmail Enviar Programado",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -240,
        2176
      ],
      "webhookId": "9bb885da-0dc2-484a-a98b-299a940ef575",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nlet result = {};\n\ntry {\n  const action = plan.action;\n\n  if (['listar','buscar'].includes(action)) {\n    const ai = $('IA Resumir Listado').item?.json?.text || $('IA Resumir Listado').item?.json?.output || '';\n    const raw = $('Formatear Emails').item?.json?.emailList || '';\n    const count = $('Formatear Emails').item?.json?.count || 0;\n    result = {\n      success: true,\n      action,\n      count,\n      result: `📬 EMAILS ENCONTRADOS (${count}):\\n\\n${raw}\\n\\n---\\n🤖 RESUMEN IA:\\n${ai}`\n    };\n\n  } else if (action === 'priorizar') {\n    const ai = $('IA Priorizar Emails').item?.json?.text || $('IA Priorizar Emails').item?.json?.output || '';\n    const count = $('Formatear Emails').item?.json?.count || 0;\n    result = { success: true, action, count, result: `📊 PRIORIZACIÓN (${count} emails):\\n\\n${ai}` };\n\n  } else if (['leer_especifico','leer_completo'].includes(action)) {\n    result = { success: true, action, result: $('Construir Lectura Completa').item?.json?.result || 'No se pudo leer el email' };\n\n  } else if (action === 'eliminar_uno') {\n    let confirmResult = null;\n    try { confirmResult = $('¿Confirmar Eliminar Uno?').item?.json; } catch(e) {}\n    if (confirmResult?.needsConfirmation === true) {\n      result = {\n        success: true,\n        needsConfirmation: true,\n        pendingAction: 'eliminar_uno',\n        pendingEmailId: confirmResult.pendingEmailId || null,\n        result: confirmResult.result || '¿Confirmas la eliminación?'\n      };\n    } else {\n      result = { \n        success: true, \n        action,\n        needsConfirmation: false,\n        result: '🗑️ Email movido a la papelera. Tienes 30 días para recuperarlo.' \n      };\n    }\n  } else if (['eliminar_lote','archivar_lote','marcar_leido_lote','marcar_no_leido_lote','spam_lote','mover_label_lote'].includes(action)) {\n    // ¿Vino del path de preview (sin confirmar)?\n    let previewResult = null;\n    try { previewResult = $('Devolver Preview Lote').item?.json; } catch(e) {}\n\n    if (previewResult?.needsConfirmation) {\n      result = previewResult;\n    } else {\n      // Ejecución confirmada\n      const actionLabels = {\n        eliminar_lote: plan.isPurge ? '🗑️💀 Eliminados permanentemente' : '🗑️ Movidos a papelera (recuperables 30 días)',\n        archivar_lote: '📦 Archivados correctamente',\n        marcar_leido_lote: '✅ Marcados como leídos',\n        marcar_no_leido_lote: '🔵 Marcados como no leídos',\n        spam_lote: '🚫 Marcados como spam',\n        mover_label_lote: `📁 Movidos a \"${plan.labelName || plan.labelId}\"`\n      };\n      const label = actionLabels[action] || action;\n      const tip = action === 'eliminar_lote' && !plan.isPurge\n        ? '\\n💡 Puedes recuperarlos en la papelera de Gmail durante 30 días.' : '';\n      result = {\n        success: true,\n        action,\n        result: `${label}.\\nQuery ejecutada: ${plan.query}${tip}`\n      };\n    }\n\n  } else if (action === 'redactar') {\n    if (plan.autoSend) {\n      result = { success: true, action, result: '✉️ Email redactado y enviado.' };\n    } else {\n      result = $('Devolver Borrador').item?.json || { success: true, action, result: 'Borrador listo.', needsConfirmation: true };\n    }\n\n  } else if (action === 'enviar') {\n    result = { success: true, action, result: '✉️ Email enviado correctamente.' };\n\n  } else if (action === 'responder') {\n    if (plan.autoSend) {\n      result = { success: true, action, result: '↩️ Respuesta enviada.' };\n    } else {\n      result = $('Devolver Respuesta').item?.json || { success: true, action, result: 'Borrador de respuesta listo.', needsConfirmation: true };\n    }\n\n  } else if (action === 'programar_envio') {\n    result = { success: true, action, result: `⏰ Email programado para el ${plan.sendAt}.` };\n\n  } else {\n    result = { success: false, action, result: `⚠️ Acción no reconocida: \"${action}\"` };\n  }\n\n} catch (e) {\n  result = { success: false, action: plan?.action || 'unknown', error: e.message };\n}\n\nreturn [{ json: result }];"
      },
      "id": "34484f13-8dde-477f-9d0e-8ac358baa03f",
      "name": "Construir Respuesta Final",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        784,
        896
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ JSON.stringify($json) }}",
        "options": {
          "responseHeaders": {
            "entries": [
              {
                "name": "Content-Type",
                "value": "application/json"
              }
            ]
          }
        }
      },
      "id": "3b08a282-780b-4907-b7de-f17593d79050",
      "name": "Responder al Asistente",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        1024,
        896
      ]
    },
    {
      "parameters": {
        "operation": "delete",
        "messageId": "={{ $json.id }}"
      },
      "id": "09faa58e-cbb3-47bd-bbe3-cf596a20d3b4",
      "name": "Gmail Eliminar Permanente",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        192,
        736
      ],
      "webhookId": "ca4fd7e3-c907-46bb-915a-66dd46bdd744",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nconst emails = $input.all().map(i => i.json);\nconst count = emails.length;\n\nconst isPurge     = /para siempre|permanente|purga|purgar/i.test(plan.originalText || '');\nconst isConfirmed = plan.confirmed === true;\nconst isDryRun    = /dry.?run|previsualiz|qué (va a|vas a|voy a)|muéstrame antes|lista antes|ver antes/i.test(plan.originalText || '');\n\nconst formatDate = (ts) => {\n  if (!ts) return '';\n  const d = new Date(parseInt(ts));\n  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'numeric'});\n};\n\nconst preview = emails.slice(0, 25).map((m, i) => {\n  const from    = m.From    || m.from    || 'Desconocido';\n  const subject = m.Subject || m.subject || 'Sin asunto';\n  const date    = formatDate(m.internalDate || m.date);\n  return `  ${i+1}. [${m.id || ''}] ${from} — \"${subject}\" (${date})`;\n}).join('\\n');\nconst moreText = count > 25 ? `\\n  ... y ${count - 25} más` : '';\n\nconst actionLabels = {\n  eliminar_lote: isPurge ? '🗑️💀 ELIMINAR PERMANENTEMENTE (irreversible)' : '🗑️ Mover a papelera (recuperable 30 días)',\n  archivar_lote: '📦 Archivar',\n  marcar_leido_lote: '✅ Marcar como leído',\n  marcar_no_leido_lote: '🔵 Marcar como no leído',\n  spam_lote: '🚫 Marcar como spam',\n  mover_label_lote: `📁 Mover a etiqueta \"${plan.labelName || plan.labelId}\"`\n};\n\nreturn [{\n  json: { emails, count, isPurge, isDryRun, isConfirmed,\n    preview: preview + moreText, plan,\n    actionLabel: actionLabels[plan.action] || plan.action }\n}];"
      },
      "id": "bc4e7087-5ea5-4c8c-baff-ca2d1a79b872",
      "name": "Contar y Validar Lote",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -256,
        864
      ]
    },
    {
      "parameters": {
        "rules": {
          "values": [
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.isConfirmed && $json.isPurge }}",
                    "rightValue": true,
                    "operator": {
                      "type": "boolean",
                      "operation": "true",
                      "singleValue": true
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "ejecutar_purge"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.isConfirmed && !$json.isPurge }}",
                    "rightValue": true,
                    "operator": {
                      "type": "boolean",
                      "operation": "true",
                      "singleValue": true
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "ejecutar_normal"
            }
          ]
        },
        "options": {
          "fallbackOutput": "extra"
        }
      },
      "id": "faa6d942-dcbe-4d2d-a5f3-9808d11220d9",
      "name": "¿Proceder con Lote?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3.2,
      "position": [
        -96,
        1008
      ]
    },
    {
      "parameters": {
        "jsCode": "const d = $input.first().json;\n\nconst warningPurge = d.isPurge \n  ? '\\n\\n⚠️ ATENCIÓN: Esta acción es IRREVERSIBLE. Los emails se eliminarán permanentemente.'\n  : d.plan.action === 'eliminar_lote' \n    ? '\\n\\n💡 Los emails irán a la papelera — tienes 30 días para recuperarlos.'\n    : '';\n\nconst confirmMsg = `Para confirmar, responde con: {\"text\": \"confirma ${d.plan.action}\", \"confirmed\": true, \"query\": \"${d.plan.query}\"${d.plan.isPurge ? ', \"purge\": true' : ''}}`;\n\nreturn [{\n  json: {\n    success: true,\n    action: d.plan.action,\n    count: d.count,\n    result: `🔍 PREVISUALIZACIÓN — ${d.actionLabel}\\n\\nAfectados: ${d.count} emails\\n\\n${d.preview}${warningPurge}\\n\\n${confirmMsg}`,\n    needsConfirmation: true,\n    pendingAction: d.plan.action,\n    pendingQuery: d.plan.query,\n    pendingCount: d.count\n  }\n}];"
      },
      "id": "1c93f8e9-8861-4271-b348-9be1c7ca9c63",
      "name": "Devolver Preview Lote",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        560,
        1168
      ]
    },
    {
      "parameters": {
        "jsCode": "const d = $input.first().json;\n// Expand each email as a separate item for the loop\nreturn d.emails.map(email => ({ json: email }));"
      },
      "id": "d4471a22-2bed-43d5-9663-d96c487f1940",
      "name": "Expandir Emails Para Loop",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        368,
        1280
      ]
    },
    {
      "parameters": {
        "jsCode": "const d = $input.first().json;\nreturn d.emails.map(email => ({ json: email }));"
      },
      "id": "9a18f8a0-ce3e-4291-a89d-1e56e98c9c77",
      "name": "Expandir Emails Para Purge",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        432,
        960
      ]
    },
    {
      "parameters": {
        "options": {}
      },
      "id": "2420a68b-219c-4595-95bb-baa09e8b01f7",
      "name": "Loop Purge",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [
        544,
        832
      ]
    },
    {
      "parameters": {
        "operation": "getAll",
        "limit": 5,
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.emailId ? 'rfc822msgid:' + $('Parsear Plan IA').item.json.emailId : $('Parsear Plan IA').item.json.query || $('Parsear Plan IA').item.json.targetHint }}"
        }
      },
      "id": "400057b2-317e-4732-9413-ccac2a4df7bd",
      "name": "Gmail Buscar Para Eliminar Uno",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -480,
        800
      ],
      "webhookId": "8f4f80b2-ff49-4970-a364-849d6ce0173e",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nconst emails = $input.all().map(i => i.json);\n\nif (!emails.length) {\n  return [{ json: { found: false, reason: 'No se encontró el email', plan } }];\n}\n\n// Si viene emailId exacto, buscar directo\nif (plan.emailId) {\n  const exact = emails.find(m => m.id === plan.emailId);\n  if (exact) return [{ json: { found: true, selected: exact } }];\n}\n\n// Sino, coger el más reciente que coincida\nconst norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');\nconst hint = norm(plan.targetHint || plan.originalText || '');\n\nconst scored = emails.map(m => {\n  const from    = norm(m.From || m.from || '');\n  const subject = norm(m.Subject || m.subject || '');\n  let score = 0;\n  if (hint) {\n    hint.split(/\\s+/).filter(w => w.length > 2).forEach(w => {\n      if (from.includes(w))    score += 10;\n      if (subject.includes(w)) score += 8;\n    });\n  }\n  score += parseInt(m.internalDate || 0) / 1e13;\n  return { msg: m, score };\n}).sort((a, b) => b.score - a.score);\n\nreturn [{ json: { found: true, selected: scored[0].msg } }];"
      },
      "id": "d39f8be2-153c-438f-acb8-b75682d6b622",
      "name": "Seleccionar Email Para Borrar",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -208,
        720
      ]
    },
    {
      "parameters": {
        "jsCode": "const d = $input.first().json;\nconst plan = $('Parsear Plan IA').item.json;\n\nif (!d.found) {\n  return [{ json: { success: false, result: 'No encontré ese email. ¿Puedes darme más detalles?' } }];\n}\n\nconst m = d.selected;\nconst from    = m.From    || m.from    || 'Desconocido';\nconst subject = m.Subject || m.subject || 'Sin asunto';\nconst formatDate = (ts) => ts ? new Date(parseInt(ts)).toLocaleString('es-ES', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}) : '';\nconst date = formatDate(m.internalDate);\n\nconst isPurge = /para siempre|permanente|purga|purgar/i.test(plan.originalText || '');\nconst trashMsg = isPurge ? '⚠️ Eliminación PERMANENTE e irreversible.' : '💡 Irá a la papelera — recuperable 30 días.';\n\nreturn [{\n  json: {\n    success: true,\n    needsConfirmation: true,\n    pendingAction: 'eliminar_uno',\n    pendingEmailId: m.id,\n    isPurge,\n    result: `🔍 Email encontrado:\\n\\nDe: ${from}\\nAsunto: ${subject}\\nFecha: ${date}\\nID: ${m.id}\\n\\n${trashMsg}\\n\\n¿Confirmas que quieres eliminarlo? Responde \"sí, confirma\"`\n  }\n}];"
      },
      "id": "4dbd90e5-0236-4913-b408-e87f03b04e06",
      "name": "Preview Eliminar Uno",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -48,
        880
      ]
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nconst d = $input.first().json;\n\nif (!d.found || !d.selected) {\n  return [{ json: { \n    success: false, \n    needsConfirmation: false,\n    result: 'No encontré ese email. ¿Puedes darme más detalles?' \n  }}];\n}\n\nconst m = d.selected;\nconst from    = m.From    || m.from    || 'Desconocido';\nconst subject = m.Subject || m.subject || 'Sin asunto';\nconst formatDate = (ts) => ts ? new Date(parseInt(ts)).toLocaleString('es-ES', {\n  day:'2-digit', month:'short', year:'numeric',\n  hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'\n}) : '';\nconst date = formatDate(m.internalDate);\nconst isPurge = /para siempre|permanente|purga|purgar/i.test(plan.originalText || '');\n\n// Si ya está confirmado → pasar el emailId para que el siguiente nodo lo elimine\nif (plan.confirmed === true) {\n  return [{ json: { \n    ...d,\n    confirmed: true,\n    resolvedEmailId: m.id,\n    isPurge\n  }}];\n}\n\n// No confirmado → devolver preview\nreturn [{ json: { \n  success: true,\n  needsConfirmation: true,\n  pendingAction: 'eliminar_uno',\n  pendingEmailId: m.id,\n  isPurge,\n  result: `🔍 Email encontrado:\\n\\nDe: ${from}\\nAsunto: ${subject}\\nFecha: ${date}\\nID: ${m.id}\\n\\n${isPurge ? '⚠️ Eliminación PERMANENTE e irreversible.' : '💡 Irá a la papelera — recuperable 30 días.'}\\n\\n¿Confirmas que quieres eliminarlo?`\n}}];"
      },
      "id": "147b0b88-2c14-46f7-aeaa-a49914fd17f3",
      "name": "¿Confirmar Eliminar Uno?",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        336,
        688
      ]
    },
    {
      "parameters": {
        "operation": "modify",
        "messageId": "={{ $json.resolvedEmailId }}",
        "addLabelIds": [
          "TRASH"
        ],
        "removeLabelIds": [
          "INBOX"
        ]
      },
      "id": "e76ed3eb-4b6d-4a8b-9a0f-e338e36ce3e4",
      "name": "Gmail Mover Uno a Papelera",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        720,
        624
      ],
      "webhookId": "2e03475b-94a3-4ca2-988d-6339fb28bf9d",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "delete",
        "messageId": "={{ $('Parsear Plan IA').item.json.emailId || $('Parsear Plan IA').item.json.pendingEmailId }}"
      },
      "id": "c2b62ffb-7512-4c94-a80f-3bb4d03e55ea",
      "name": "Gmail Eliminar Uno Permanente",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        816,
        1104
      ],
      "webhookId": "7e85eb79-151f-4678-8316-c2d56d62b584",
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": false,
            "leftValue": "",
            "typeValidation": "loose"
          },
          "conditions": [
            {
              "leftValue": "={{ $json.confirmed }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "true",
                "singleValue": true
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "27f40151-003f-48ab-a479-4c6c6dcdd062",
      "name": "IF Ejecutar Eliminar",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [
        496,
        672
      ]
    }
  ],
  "pinData": {},
  "connections": {
    "Webhook Entrada": {
      "main": [
        [
          {
            "node": "Parsear Petición",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parsear Petición": {
      "main": [
        [
          {
            "node": "IA Planificar Acción",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Modelo IA Planificador": {
      "ai_languageModel": [
        [
          {
            "node": "IA Planificar Acción",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "IA Planificar Acción": {
      "main": [
        [
          {
            "node": "Parsear Plan IA",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parsear Plan IA": {
      "main": [
        [
          {
            "node": "Router Inteligente",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Router Inteligente": {
      "main": [
        [
          {
            "node": "Gmail Buscar Para Listar",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Lectura",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Lectura",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Listar",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Eliminar Uno",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Lote",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Lote",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Lote",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Lote",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Lote",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Buscar Para Lote",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preparar Redacción",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Enviar Directo",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Obtener Para Responder",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Esperar Hasta Envío",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Buscar Para Listar": {
      "main": [
        [
          {
            "node": "Formatear Emails",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Buscar": {
      "main": [
        [
          {
            "node": "Formatear Emails",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Formatear Emails": {
      "main": [
        [
          {
            "node": "IA Resumir Listado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Modelo IA Resumen": {
      "ai_languageModel": [
        [
          {
            "node": "IA Resumir Listado",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "Modelo IA Priorizar": {
      "ai_languageModel": [
        [
          {
            "node": "IA Priorizar Emails",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "IA Resumir Listado": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "IA Priorizar Emails": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Buscar Para Lectura": {
      "main": [
        [
          {
            "node": "Seleccionar Mejor Email",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Seleccionar Mejor Email": {
      "main": [
        [
          {
            "node": "Gmail Obtener Email Completo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Obtener Email Completo": {
      "main": [
        [
          {
            "node": "Construir Lectura Completa",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Construir Lectura Completa": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Buscar Para Lote": {
      "main": [
        [
          {
            "node": "Contar y Validar Lote",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Loop Lote": {
      "main": [
        [
          {
            "node": "Router Lote",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Router Lote": {
      "main": [
        [],
        [
          {
            "node": "Gmail Archivar",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Marcar Leído",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Marcar No Leído",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Gmail Marcar Spam",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Resolver Label",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Archivar": {
      "main": [
        [
          {
            "node": "Loop Lote",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Marcar Leído": {
      "main": [
        [
          {
            "node": "Loop Lote",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Marcar No Leído": {
      "main": [
        [
          {
            "node": "Loop Lote",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Marcar Spam": {
      "main": [
        [
          {
            "node": "Loop Lote",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Resolver Label": {
      "main": [
        [
          {
            "node": "Gmail Mover a Label",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Mover a Label": {
      "main": [
        [
          {
            "node": "Loop Lote",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar Redacción": {
      "main": [
        [
          {
            "node": "IA Redactar Email",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Modelo IA Redactar": {
      "ai_languageModel": [
        [
          {
            "node": "IA Redactar Email",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "IA Redactar Email": {
      "main": [
        [
          {
            "node": "¿Enviar Directamente?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Enviar Directamente?": {
      "main": [
        [
          {
            "node": "Gmail Enviar Redactado",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Devolver Borrador",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Enviar Redactado": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Devolver Borrador": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Enviar Directo": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Obtener Para Responder": {
      "main": [
        [
          {
            "node": "Preparar Respuesta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar Respuesta": {
      "main": [
        [
          {
            "node": "IA Redactar Respuesta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Modelo IA Responder": {
      "ai_languageModel": [
        [
          {
            "node": "IA Redactar Respuesta",
            "type": "ai_languageModel",
            "index": 0
          }
        ]
      ]
    },
    "IA Redactar Respuesta": {
      "main": [
        [
          {
            "node": "¿Enviar Respuesta Ya?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Enviar Respuesta Ya?": {
      "main": [
        [
          {
            "node": "Gmail Enviar Respuesta",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Devolver Respuesta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Enviar Respuesta": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Devolver Respuesta": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Esperar Hasta Envío": {
      "main": [
        [
          {
            "node": "Gmail Enviar Programado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Enviar Programado": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Construir Respuesta Final": {
      "main": [
        [
          {
            "node": "Responder al Asistente",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Contar y Validar Lote": {
      "main": [
        [
          {
            "node": "¿Proceder con Lote?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Proceder con Lote?": {
      "main": [
        [
          {
            "node": "Devolver Preview Lote",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Expandir Emails Para Purge",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Expandir Emails Para Loop",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Devolver Preview Lote": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Expandir Emails Para Loop": {
      "main": [
        [
          {
            "node": "Loop Lote",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Expandir Emails Para Purge": {
      "main": [
        [
          {
            "node": "Loop Purge",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Loop Purge": {
      "main": [
        [
          {
            "node": "Gmail Eliminar Permanente",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Eliminar Permanente": {
      "main": [
        [
          {
            "node": "Loop Purge",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Mover a Papelera": {
      "main": [
        [
          {
            "node": "Loop Lote",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Buscar Para Eliminar Uno": {
      "main": [
        [
          {
            "node": "Seleccionar Email Para Borrar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Seleccionar Email Para Borrar": {
      "main": [
        [
          {
            "node": "¿Confirmar Eliminar Uno?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "¿Confirmar Eliminar Uno?": {
      "main": [
        [
          {
            "node": "IF Ejecutar Eliminar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Mover Uno a Papelera": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Gmail Eliminar Uno Permanente": {
      "main": [
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "IF Ejecutar Eliminar": {
      "main": [
        [
          {
            "node": "Gmail Mover Uno a Papelera",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Construir Respuesta Final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1",
    "binaryMode": "separate"
  },
  "versionId": "2a06ba01-d533-4931-9870-e371e415aa87",
  "meta": {
    "instanceId": "b5cd3c088f8394d49e073cf4f1c3f7cf25b3c14c5b15f0522cb049331fefe48c"
  },
  "id": "kCTadpWXYLQdR2En",
  "tags": []
}
