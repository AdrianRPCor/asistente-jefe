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
      "id": "webhook-entrada-pro",
      "name": "Webhook Entrada",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [
        -1600,
        260
      ],
      "webhookId": "86651dd0-dec6-4828-afbe-561d76c3ea16-pro"
    },
    {
      "parameters": {
        "jsCode": "const body = $input.first().json.body || $input.first().json || {};\nconst text = body.text || body.input || body.query || body.content || '';\nconst autoSend = body.autoSend === true;\nconst confirmed = body.confirmed === true;\nconst to = body.to || '';\nconst subject = body.subject || '';\nconst content = body.content || '';\nconst emailId = body.emailId || '';\nconst threadId = body.threadId || '';\nconst labelName = body.labelName || body.label || '';\nconst labelId = body.labelId || '';\nconst sendAt = body.sendAt || body.scheduleAt || '';\nconst timezone = body.timezone || 'Europe/Madrid';\nconst account = body.account || 'personal';\n\nreturn [{\n  json: {\n    raw_body: body,\n    text,\n    autoSend,\n    confirmed,\n    to,\n    subject,\n    content,\n    emailId,\n    threadId,\n    labelName,\n    labelId,\n    sendAt,\n    timezone,\n    account\n  }\n}];"
      },
      "id": "parsear-peticion-pro",
      "name": "Parsear Petición",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -1380,
        260
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "Eres un planificador experto de Gmail. Tu única función es convertir la petición del usuario en JSON válido.\n\nCRÍTICO: Devuelve ÚNICAMENTE el objeto JSON. Sin texto antes, sin texto después, sin bloques markdown, sin explicaciones.\n\nEsquema de respuesta:\n{\n  \"action\": \"listar|buscar|leer_especifico|leer_completo|priorizar|eliminar_uno|eliminar_lote|archivar_lote|marcar_leido_lote|marcar_no_leido_lote|spam_lote|mover_label_lote|redactar|enviar|responder|programar_envio\",\n  \"query\": \"consulta Gmail search sintaxis nativa\",\n  \"targetHint\": \"nombre, email o asunto si aplica\",\n  \"emailId\": \"si el usuario lo proporcionó explícitamente\",\n  \"to\": \"destinatario si aplica\",\n  \"subject\": \"asunto si aplica\",\n  \"content\": \"contenido/instrucciones del email si aplica\",\n  \"labelName\": \"nombre etiqueta si aplica\",\n  \"labelId\": \"id etiqueta si aplica\",\n  \"sendAt\": \"fecha ISO 8601 si aplica\",\n  \"limit\": 10,\n  \"autoSend\": true,\n  \"reason\": \"una frase breve explicando la acción elegida\"\n}\n\nReglas de mapeo de acciones:\n- \"borra/elimina todos...\" → eliminar_lote\n- \"borra/elimina este/ese/el de X\" (uno solo) → eliminar_uno (usa emailId si disponible, sino targetHint)\n- \"purga/elimina para siempre/permanente...\" → eliminar_lote (y en originalText quedará la intención de purgar)\n- \"archiva...\" → archivar_lote\n- \"marca como leído...\" → marcar_leido_lote\n- \"marca como no leído...\" → marcar_no_leido_lote\n- \"marca como spam/correo no deseado...\" → spam_lote\n- \"mueve a la etiqueta/carpeta...\" → mover_label_lote\n- \"léeme el email de X / léeme el de X\" → leer_especifico\n- \"léeme completo / muéstrame todo...\" → leer_completo\n- \"responde a...\" → responder\n- \"envía un email a...\" → enviar\n- \"programa/enviar más tarde...\" → programar_envio\n- \"prioriza/clasifica/ordena por importancia...\" → priorizar\n- \"muéstrame/lista/dame los emails...\" → listar\n- \"busca emails de/sobre/con...\" → buscar\n- \"redacta/escribe un email...\" → redactar\n\nReglas de query Gmail:\n- Sin query clara para listar/priorizar → usa \"in:inbox\"\n- Remitente → from:email@ejemplo.com\n- Asunto → subject:\"texto\"\n- Antes de fecha → before:YYYY/MM/DD\n- Después de fecha → after:YYYY/MM/DD\n- No leídos → is:unread\n- Marketing/promociones → category:promotions\n- Con adjunto → has:attachment\n\nautoSend debe respetar exactamente el valor de {{$json.autoSend}}.\nSi ya viene emailId en los datos adicionales, úsalo directamente.\n\nINPUT DEL USUARIO:\n{{$json.text}}\n\nDATOS ADICIONALES (usar si el usuario no los especificó explícitamente en el texto):\nto={{$json.to}}\nsubject={{$json.subject}}\ncontent={{$json.content}}\nemailId={{$json.emailId}}\nlabelName={{$json.labelName}}\nlabelId={{$json.labelId}}\nsendAt={{$json.sendAt}}\nautoSend={{$json.autoSend}}\n\nJSON:"
      },
      "id": "ia-planificar",
      "name": "IA Planificar Acción",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        -1140,
        260
      ]
    },
    {
      "parameters": {
        "model": "claude-sonnet-4-20250514",
        "options": {}
      },
      "id": "modelo-planificador",
      "name": "Modelo IA Planificador",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        -1140,
        100
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
      "id": "parsear-plan",
      "name": "Parsear Plan IA",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -900,
        260
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
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "listar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "listar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "buscar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "buscar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "leer_especifico",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "leer_especifico"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "leer_completo",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "leer_completo"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "priorizar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "priorizar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "eliminar_uno",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "eliminar_uno"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "eliminar_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "eliminar_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "archivar_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "archivar_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "marcar_leido_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "marcar_leido_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "marcar_no_leido_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "marcar_no_leido_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "spam_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "spam_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "mover_label_lote",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "mover_label_lote"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "redactar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "redactar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "enviar",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "enviar"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "responder",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
              },
              "renameOutput": true,
              "outputKey": "responder"
            },
            {
              "conditions": {
                "options": {
                  "caseSensitive": false
                },
                "conditions": [
                  {
                    "leftValue": "={{ $json.action }}",
                    "rightValue": "programar_envio",
                    "operator": {
                      "type": "string",
                      "operation": "equals"
                    }
                  }
                ]
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
      "id": "router-pro",
      "name": "Router Inteligente",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [
        -660,
        260
      ]
    },
    {
      "parameters": {
        "operation": "getAll",
        "limit": "={{ $('Parsear Plan IA').item.json.limit || 10 }}",
        "simple": true,
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.query || 'is:unread in:inbox' }}"
        },
        "options": {}
      },
      "id": "gmail-listar",
      "name": "Gmail Buscar Para Listar",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -360,
        -240
      ],
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
        "simple": true,
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.query }}"
        },
        "options": {}
      },
      "id": "gmail-buscar",
      "name": "Gmail Buscar",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -360,
        -120
      ],
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
        "simple": true,
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.query || $('Parsear Plan IA').item.json.targetHint }}"
        },
        "options": {}
      },
      "id": "gmail-buscar-lectura",
      "name": "Gmail Buscar Para Lectura",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -360,
        40
      ],
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
      "id": "seleccionar-mejor-email",
      "name": "Seleccionar Mejor Email",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -120,
        40
      ]
    },
    {
      "parameters": {
        "operation": "get",
        "messageId": "={{ $('Seleccionar Mejor Email').item.json.selected.id || $('Parsear Plan IA').item.json.emailId }}"
      },
      "id": "gmail-get-full",
      "name": "Gmail Obtener Email Completo",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        120,
        40
      ],
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
      "id": "formatear-emails",
      "name": "Formatear Emails",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -120,
        -180
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ 'Eres un asistente de email. Resume en español estos emails de forma clara, útil y concisa. Destaca los urgentes o importantes al principio. Sé directo, no repitas información obvia.\\n\\nEmails:\\n' + $json.emailList }}"
      },
      "id": "ia-resumir-listado",
      "name": "IA Resumir Listado",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        120,
        -180
      ]
    },
    {
      "parameters": {
        "model": "claude-haiku-4-5-20251001",
        "options": {}
      },
      "id": "modelo-resumen",
      "name": "Modelo IA Resumen",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        120,
        -340
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
      "id": "ia-priorizar",
      "name": "IA Priorizar Emails",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        120,
        -40
      ]
    },
    {
      "parameters": {
        "model": "claude-haiku-4-5-20251001",
        "options": {}
      },
      "id": "modelo-priorizar",
      "name": "Modelo IA Priorizar",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        120,
        -90
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
      "id": "construir-lectura-completa",
      "name": "Construir Lectura Completa",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        360,
        40
      ]
    },
    {
      "parameters": {
        "operation": "getAll",
        "limit": 100,
        "simple": true,
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.query }}"
        },
        "options": {}
      },
      "id": "gmail-buscar-lote",
      "name": "Gmail Buscar Para Lote",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -360,
        460
      ],
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "id": "loop-lote",
      "name": "Loop Lote",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [
        -120,
        460
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
      "id": "router-lote",
      "name": "Router Lote",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [
        120,
        460
      ]
    },
    {
      "parameters": {
        "operation": "modify",
        "messageId": "={{ $json.id }}",
        "addLabelIds": [
          "TRASH"
        ],
        "removeLabelIds": [
          "INBOX"
        ]
      },
      "id": "gmail-eliminar",
      "name": "Gmail Mover a Papelera",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        360,
        300
      ],
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "modify",
        "messageId": "={{ $json.id }}",
        "removeLabelIds": [
          "INBOX"
        ]
      },
      "id": "gmail-archivar",
      "name": "Gmail Archivar",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        360,
        380
      ],
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "modify",
        "messageId": "={{ $json.id }}",
        "removeLabelIds": [
          "UNREAD"
        ]
      },
      "id": "gmail-marcar-leido",
      "name": "Gmail Marcar Leído",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        360,
        460
      ],
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "modify",
        "messageId": "={{ $json.id }}",
        "addLabelIds": [
          "UNREAD"
        ]
      },
      "id": "gmail-marcar-no-leido",
      "name": "Gmail Marcar No Leído",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        360,
        540
      ],
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "operation": "modify",
        "messageId": "={{ $json.id }}",
        "addLabelIds": [
          "SPAM"
        ]
      },
      "id": "gmail-spam",
      "name": "Gmail Marcar Spam",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        360,
        620
      ],
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
      "id": "resolver-label",
      "name": "Resolver Label",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        360,
        700
      ]
    },
    {
      "parameters": {
        "operation": "modify",
        "messageId": "={{ $json.id }}",
        "addLabelIds": "={{ [$json.resolvedLabelId] }}",
        "removeLabelIds": [
          "INBOX"
        ]
      },
      "id": "gmail-mover-label",
      "name": "Gmail Mover a Label",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        600,
        700
      ],
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
      "id": "prep-redactar",
      "name": "Preparar Redacción",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -360,
        860
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.prompt }}"
      },
      "id": "ia-redactar",
      "name": "IA Redactar Email",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        -120,
        860
      ]
    },
    {
      "parameters": {
        "model": "claude-haiku-4-5-20251001",
        "options": {}
      },
      "id": "modelo-redactar",
      "name": "Modelo IA Redactar",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        -120,
        1020
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
      "id": "if-autosend-redactar",
      "name": "¿Enviar Directamente?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [
        120,
        860
      ]
    },
    {
      "parameters": {
        "sendTo": "={{ $('Parsear Plan IA').item.json.to }}",
        "subject": "={{ $('Parsear Plan IA').item.json.subject }}",
        "message": "={{ $json.text || $json.output || '' }}",
        "options": {}
      },
      "id": "gmail-enviar-redactado",
      "name": "Gmail Enviar Redactado",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        360,
        820
      ],
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
      "id": "devolver-borrador",
      "name": "Devolver Borrador",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        360,
        900
      ]
    },
    {
      "parameters": {
        "sendTo": "={{ $('Parsear Plan IA').item.json.to }}",
        "subject": "={{ $('Parsear Plan IA').item.json.subject }}",
        "message": "={{ $('Parsear Plan IA').item.json.content || $('Parsear Plan IA').item.json.originalText }}",
        "options": {}
      },
      "id": "gmail-enviar-directo",
      "name": "Gmail Enviar Directo",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -360,
        1120
      ],
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
      "id": "gmail-get-responder",
      "name": "Gmail Obtener Para Responder",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -360,
        1260
      ],
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
      "id": "prep-respuesta",
      "name": "Preparar Respuesta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -120,
        1260
      ]
    },
    {
      "parameters": {
        "promptType": "define",
        "text": "={{ $json.prompt }}"
      },
      "id": "ia-responder",
      "name": "IA Redactar Respuesta",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [
        120,
        1260
      ]
    },
    {
      "parameters": {
        "model": "claude-haiku-4-5-20251001",
        "options": {}
      },
      "id": "modelo-responder",
      "name": "Modelo IA Responder",
      "type": "@n8n/n8n-nodes-langchain.lmChatAnthropic",
      "typeVersion": 1.3,
      "position": [
        120,
        1420
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
      "id": "if-autosend-respuesta",
      "name": "¿Enviar Respuesta Ya?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3,
      "position": [
        360,
        1260
      ]
    },
    {
      "parameters": {
        "sendTo": "={{ $('Preparar Respuesta').item.json.replyTo || $('Gmail Obtener Para Responder').item.json.from || '' }}",
        "subject": "={{ 'Re: ' + ($('Preparar Respuesta').item.json.subject || '') }}",
        "message": "={{ $json.text || $json.output || '' }}",
        "options": {
          "replyToMessageId": "={{ $('Preparar Respuesta').item.json.replyToMessageId }}"
        }
      },
      "id": "gmail-enviar-respuesta",
      "name": "Gmail Enviar Respuesta",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        600,
        1220
      ],
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
      "id": "devolver-respuesta",
      "name": "Devolver Respuesta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        600,
        1300
      ]
    },
    {
      "parameters": {
        "resume": "specificTime",
        "dateTime": "={{ $('Parsear Plan IA').item.json.sendAt }}"
      },
      "id": "wait-programado",
      "name": "Esperar Hasta Envío",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1.1,
      "position": [
        -360,
        1540
      ]
    },
    {
      "parameters": {
        "sendTo": "={{ $('Parsear Plan IA').item.json.to }}",
        "subject": "={{ $('Parsear Plan IA').item.json.subject }}",
        "message": "={{ $('Parsear Plan IA').item.json.content || $('Parsear Plan IA').item.json.originalText }}",
        "options": {}
      },
      "id": "gmail-enviar-programado",
      "name": "Gmail Enviar Programado",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -120,
        1540
      ],
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nlet result = {};\n\ntry {\n  const action = plan.action;\n\n  if (['listar','buscar'].includes(action)) {\n    const ai = $('IA Resumir Listado').item?.json?.text || $('IA Resumir Listado').item?.json?.output || '';\n    const raw = $('Formatear Emails').item?.json?.emailList || '';\n    const count = $('Formatear Emails').item?.json?.count || 0;\n    result = {\n      success: true,\n      action,\n      count,\n      result: `📬 EMAILS ENCONTRADOS (${count}):\\n\\n${raw}\\n\\n---\\n🤖 RESUMEN IA:\\n${ai}`\n    };\n\n  } else if (action === 'priorizar') {\n    const ai = $('IA Priorizar Emails').item?.json?.text || $('IA Priorizar Emails').item?.json?.output || '';\n    const count = $('Formatear Emails').item?.json?.count || 0;\n    result = { success: true, action, count, result: `📊 PRIORIZACIÓN (${count} emails):\\n\\n${ai}` };\n\n  } else if (['leer_especifico','leer_completo'].includes(action)) {\n    result = { success: true, action, result: $('Construir Lectura Completa').item?.json?.result || 'No se pudo leer el email' };\n\n  } else if (action === 'eliminar_uno') {\n    let previewResult = null;\n    try { previewResult = $('Preview Eliminar Uno').item?.json; } catch(e) {}\n    if (previewResult?.needsConfirmation) {\n      result = previewResult;\n    } else {\n      result = { success: true, action, result: '🗑️ Email movido a la papelera correctamente. Tienes 30 días para recuperarlo si fue un error.' };\n    }\n  } else if (action === 'eliminar_lote') {\n  } else if (['eliminar_lote','archivar_lote','marcar_leido_lote','marcar_no_leido_lote','spam_lote','mover_label_lote'].includes(action)) {\n    // ¿Vino del path de preview (sin confirmar)?\n    let previewResult = null;\n    try { previewResult = $('Devolver Preview Lote').item?.json; } catch(e) {}\n\n    if (previewResult?.needsConfirmation) {\n      result = previewResult;\n    } else {\n      // Ejecución confirmada\n      const actionLabels = {\n        eliminar_lote: plan.isPurge ? '🗑️💀 Eliminados permanentemente' : '🗑️ Movidos a papelera (recuperables 30 días)',\n        archivar_lote: '📦 Archivados correctamente',\n        marcar_leido_lote: '✅ Marcados como leídos',\n        marcar_no_leido_lote: '🔵 Marcados como no leídos',\n        spam_lote: '🚫 Marcados como spam',\n        mover_label_lote: `📁 Movidos a \"${plan.labelName || plan.labelId}\"`\n      };\n      const label = actionLabels[action] || action;\n      const tip = action === 'eliminar_lote' && !plan.isPurge\n        ? '\\n💡 Puedes recuperarlos en la papelera de Gmail durante 30 días.' : '';\n      result = {\n        success: true,\n        action,\n        result: `${label}.\\nQuery ejecutada: ${plan.query}${tip}`\n      };\n    }\n\n  } else if (action === 'redactar') {\n    if (plan.autoSend) {\n      result = { success: true, action, result: '✉️ Email redactado y enviado.' };\n    } else {\n      result = $('Devolver Borrador').item?.json || { success: true, action, result: 'Borrador listo.', needsConfirmation: true };\n    }\n\n  } else if (action === 'enviar') {\n    result = { success: true, action, result: '✉️ Email enviado correctamente.' };\n\n  } else if (action === 'responder') {\n    if (plan.autoSend) {\n      result = { success: true, action, result: '↩️ Respuesta enviada.' };\n    } else {\n      result = $('Devolver Respuesta').item?.json || { success: true, action, result: 'Borrador de respuesta listo.', needsConfirmation: true };\n    }\n\n  } else if (action === 'programar_envio') {\n    result = { success: true, action, result: `⏰ Email programado para el ${plan.sendAt}.` };\n\n  } else {\n    result = { success: false, action, result: `⚠️ Acción no reconocida: \"${action}\"` };\n  }\n\n} catch (e) {\n  result = { success: false, action: plan?.action || 'unknown', error: e.message };\n}\n\nreturn [{ json: result }];"
      },
      "id": "construir-respuesta-final",
      "name": "Construir Respuesta Final",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        900,
        260
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
      "id": "responder-webhook",
      "name": "Responder al Asistente",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        1140,
        260
      ]
    },
    {
      "id": "purge-permanent-001",
      "name": "Gmail Eliminar Permanente",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        360,
        220
      ],
      "parameters": {
        "operation": "delete",
        "messageId": "={{ $json.id }}"
      },
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "id": "contar-lote-001",
      "name": "Contar y Validar Lote",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -120,
        380
      ],
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nconst emails = $input.all().map(i => i.json);\nconst count = emails.length;\n\nconst isPurge     = /para siempre|permanente|purga|purgar/i.test(plan.originalText || '');\nconst isConfirmed = plan.confirmed === true;\nconst isDryRun    = /dry.?run|previsualiz|qué (va a|vas a|voy a)|muéstrame antes|lista antes|ver antes/i.test(plan.originalText || '');\n\nconst formatDate = (ts) => {\n  if (!ts) return '';\n  const d = new Date(parseInt(ts));\n  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'numeric'});\n};\n\nconst preview = emails.slice(0, 25).map((m, i) => {\n  const from    = m.From    || m.from    || 'Desconocido';\n  const subject = m.Subject || m.subject || 'Sin asunto';\n  const date    = formatDate(m.internalDate || m.date);\n  return `  ${i+1}. [${m.id || ''}] ${from} — \"${subject}\" (${date})`;\n}).join('\\n');\nconst moreText = count > 25 ? `\\n  ... y ${count - 25} más` : '';\n\nconst actionLabels = {\n  eliminar_lote: isPurge ? '🗑️💀 ELIMINAR PERMANENTEMENTE (irreversible)' : '🗑️ Mover a papelera (recuperable 30 días)',\n  archivar_lote: '📦 Archivar',\n  marcar_leido_lote: '✅ Marcar como leído',\n  marcar_no_leido_lote: '🔵 Marcar como no leído',\n  spam_lote: '🚫 Marcar como spam',\n  mover_label_lote: `📁 Mover a etiqueta \"${plan.labelName || plan.labelId}\"`\n};\n\nreturn [{\n  json: { emails, count, isPurge, isDryRun, isConfirmed,\n    preview: preview + moreText, plan,\n    actionLabel: actionLabels[plan.action] || plan.action }\n}];"
      }
    },
    {
      "id": "switch-lote-001",
      "name": "¿Proceder con Lote?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3.2,
      "position": [
        120,
        380
      ],
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
      }
    },
    {
      "id": "preview-lote-001",
      "name": "Devolver Preview Lote",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        360,
        340
      ],
      "parameters": {
        "jsCode": "const d = $input.first().json;\n\nconst warningPurge = d.isPurge \n  ? '\\n\\n⚠️ ATENCIÓN: Esta acción es IRREVERSIBLE. Los emails se eliminarán permanentemente.'\n  : d.plan.action === 'eliminar_lote' \n    ? '\\n\\n💡 Los emails irán a la papelera — tienes 30 días para recuperarlos.'\n    : '';\n\nconst confirmMsg = `Para confirmar, responde con: {\"text\": \"confirma ${d.plan.action}\", \"confirmed\": true, \"query\": \"${d.plan.query}\"${d.plan.isPurge ? ', \"purge\": true' : ''}}`;\n\nreturn [{\n  json: {\n    success: true,\n    action: d.plan.action,\n    count: d.count,\n    result: `🔍 PREVISUALIZACIÓN — ${d.actionLabel}\\n\\nAfectados: ${d.count} emails\\n\\n${d.preview}${warningPurge}\\n\\n${confirmMsg}`,\n    needsConfirmation: true,\n    pendingAction: d.plan.action,\n    pendingQuery: d.plan.query,\n    pendingCount: d.count\n  }\n}];"
      }
    },
    {
      "id": "expandir-lote-001",
      "name": "Expandir Emails Para Loop",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        360,
        460
      ],
      "parameters": {
        "jsCode": "const d = $input.first().json;\n// Expand each email as a separate item for the loop\nreturn d.emails.map(email => ({ json: email }));"
      }
    },
    {
      "id": "expandir-purge-001",
      "name": "Expandir Emails Para Purge",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        360,
        240
      ],
      "parameters": {
        "jsCode": "const d = $input.first().json;\nreturn d.emails.map(email => ({ json: email }));"
      }
    },
    {
      "id": "loop-purge-001",
      "name": "Loop Purge",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [
        600,
        220
      ],
      "parameters": {
        "batchSize": 1,
        "options": {}
      }
    },
    {
      "id": "buscar-eliminar-uno-001",
      "name": "Gmail Buscar Para Eliminar Uno",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        -360,
        160
      ],
      "parameters": {
        "operation": "getAll",
        "limit": 5,
        "simple": true,
        "filters": {
          "q": "={{ $('Parsear Plan IA').item.json.emailId ? 'rfc822msgid:' + $('Parsear Plan IA').item.json.emailId : $('Parsear Plan IA').item.json.query || $('Parsear Plan IA').item.json.targetHint }}"
        },
        "options": {}
      },
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "id": "seleccionar-borrar-001",
      "name": "Seleccionar Email Para Borrar",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        -120,
        160
      ],
      "parameters": {
        "jsCode": "const plan = $('Parsear Plan IA').item.json;\nconst emails = $input.all().map(i => i.json);\n\nif (!emails.length) {\n  return [{ json: { found: false, reason: 'No se encontró el email', plan } }];\n}\n\n// Si viene emailId exacto, buscar directo\nif (plan.emailId) {\n  const exact = emails.find(m => m.id === plan.emailId);\n  if (exact) return [{ json: { found: true, selected: exact } }];\n}\n\n// Sino, coger el más reciente que coincida\nconst norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');\nconst hint = norm(plan.targetHint || plan.originalText || '');\n\nconst scored = emails.map(m => {\n  const from    = norm(m.From || m.from || '');\n  const subject = norm(m.Subject || m.subject || '');\n  let score = 0;\n  if (hint) {\n    hint.split(/\\s+/).filter(w => w.length > 2).forEach(w => {\n      if (from.includes(w))    score += 10;\n      if (subject.includes(w)) score += 8;\n    });\n  }\n  score += parseInt(m.internalDate || 0) / 1e13;\n  return { msg: m, score };\n}).sort((a, b) => b.score - a.score);\n\nreturn [{ json: { found: true, selected: scored[0].msg } }];"
      }
    },
    {
      "id": "preview-eliminar-uno-001",
      "name": "Preview Eliminar Uno",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        120,
        160
      ],
      "parameters": {
        "jsCode": "const d = $input.first().json;\nconst plan = $('Parsear Plan IA').item.json;\n\nif (!d.found) {\n  return [{ json: { success: false, result: 'No encontré ese email. ¿Puedes darme más detalles?' } }];\n}\n\nconst m = d.selected;\nconst from    = m.From    || m.from    || 'Desconocido';\nconst subject = m.Subject || m.subject || 'Sin asunto';\nconst formatDate = (ts) => ts ? new Date(parseInt(ts)).toLocaleString('es-ES', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}) : '';\nconst date = formatDate(m.internalDate);\n\nconst isPurge = /para siempre|permanente|purga|purgar/i.test(plan.originalText || '');\nconst trashMsg = isPurge ? '⚠️ Eliminación PERMANENTE e irreversible.' : '💡 Irá a la papelera — recuperable 30 días.';\n\nreturn [{\n  json: {\n    success: true,\n    needsConfirmation: true,\n    pendingAction: 'eliminar_uno',\n    pendingEmailId: m.id,\n    isPurge,\n    result: `🔍 Email encontrado:\\n\\nDe: ${from}\\nAsunto: ${subject}\\nFecha: ${date}\\nID: ${m.id}\\n\\n${trashMsg}\\n\\n¿Confirmas que quieres eliminarlo? Responde \"sí, confirma\"`\n  }\n}];"
      }
    },
    {
      "id": "switch-eliminar-uno-001",
      "name": "¿Confirmar Eliminar Uno?",
      "type": "n8n-nodes-base.switch",
      "typeVersion": 3.2,
      "position": [
        360,
        160
      ],
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
                    "leftValue": "={{ $('Parsear Plan IA').item.json.confirmed }}",
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
              "outputKey": "ejecutar"
            }
          ]
        },
        "options": {
          "fallbackOutput": "extra"
        }
      }
    },
    {
      "id": "borrar-uno-001",
      "name": "Gmail Mover Uno a Papelera",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        600,
        120
      ],
      "parameters": {
        "operation": "modify",
        "messageId": "={{ $('Parsear Plan IA').item.json.emailId || $('Parsear Plan IA').item.json.pendingEmailId }}",
        "addLabelIds": [
          "TRASH"
        ],
        "removeLabelIds": [
          "INBOX"
        ]
      },
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
    },
    {
      "id": "purge-uno-001",
      "name": "Gmail Eliminar Uno Permanente",
      "type": "n8n-nodes-base.gmail",
      "typeVersion": 2.1,
      "position": [
        600,
        200
      ],
      "parameters": {
        "operation": "delete",
        "messageId": "={{ $('Parsear Plan IA').item.json.emailId || $('Parsear Plan IA').item.json.pendingEmailId }}"
      },
      "credentials": {
        "gmailOAuth2": {
          "id": "6mzgNDRrVjdcFxeW",
          "name": "Gmail account 2"
        }
      }
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
        ],
        [
          {
            "node": "IA Priorizar Emails",
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
        [
          {
            "node": "Gmail Eliminar",
            "type": "main",
            "index": 0
          }
        ],
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
            "node": "Gmail Mover Uno a Papelera",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preview Eliminar Uno",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preview Eliminar Uno": {
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
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1",
    "binaryMode": "separate",
    "availableInMCP": false
  },
  "versionId": "pro-generated-v1",
  "meta": {
    "templateCredsSetupCompleted": true
  },
  "tags": []
}
