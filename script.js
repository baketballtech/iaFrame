const chat = document.getElementById("chat");
const input = document.getElementById("userInput");
const btn = document.getElementById("sendBtn");

// Configuração do Groq
const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Modelos disponíveis no Groq:
// - llama-3.1-8b-instant (mais rápido, 8K contexto)
// - llama-3.1-70b-versatile (mais inteligente, 8K contexto)
// - mixtral-8x7b-32768 (32K contexto)
// - gemma-7b-it (7B, rápido)

const MODEL = "llama-3.1-8b-instant"; // Escolha seu modelo preferido

/**
 * Adiciona uma mensagem ao chat
 */
function addMsg(text, type) {
  const div = document.createElement("div");
  div.className = `msg ${type}`;

  // Detecta blocos de código delimitados por ```
  const codeRegex = /```([\s\S]*?)```/g; // pega tudo entre ```
  let lastIndex = 0;
  let match;
  while ((match = codeRegex.exec(text)) !== null) {
    // Texto antes do código
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index);
      const span = document.createElement("span");
      span.textContent = normalText;
      div.appendChild(span);
    }

    // Bloco de código
    const codeBlock = match[1]; // o conteúdo dentro de ```
    const pre = document.createElement("pre");
    const codeElem = document.createElement("code");
    codeElem.textContent = codeBlock;
    pre.appendChild(codeElem);
    div.appendChild(pre);

    lastIndex = match.index + match[0].length;
  }

  // Texto após o último bloco de código
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    const span = document.createElement("span");
    span.textContent = remainingText;
    div.appendChild(span);
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}


/**
 * Envia mensagem para o Groq API
 */
async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  // Mensagem do usuário
  addMsg(text, "user");
  input.value = "";

  // Mensagem de carregamento
  const loading = document.createElement("div");
  loading.className = "msg bot";
  loading.textContent = "🤔 Pensando...";
  chat.appendChild(loading);
  chat.scrollTop = chat.scrollHeight;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "Você é um assistente útil. Responda em português de forma clara e concisa."
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 1024,
        temperature: 0.7,
        stream: false, // Mude para true para streaming
        top_p: 0.9
      })
    });

    // Remove mensagem de carregamento
    chat.removeChild(loading);

    // Verifica erros
    if (!response.ok) {
      const errorData = await response.json();
      const errorMsg = errorData.error?.message || `Erro ${response.status}`;
      addMsg(`❌ Erro: ${errorMsg}`, "bot");
      
      // Dica específica para rate limit
      if (response.status === 429) {
        addMsg("⏰ Rate limit atingido. Tente novamente em alguns segundos.", "bot");
      }
      return;
    }

    const data = await response.json();
    
    // Extrai resposta
    if (data.choices && data.choices[0] && data.choices[0].message) {
      addMsg(data.choices[0].message.content, "bot");
    } else {
      addMsg("⚠️ Resposta inesperada da API.", "bot");
    }

  } catch (err) {
    console.error("Erro:", err);
    chat.removeChild(loading);
    addMsg("🔌 Erro de conexão. Verifique sua internet.", "bot");
  }
}

/**
 * Versão com STREAMING (mais fluida)
 */
async function sendMessageStreaming() {
  const text = input.value.trim();
  if (!text) return;

  addMsg(text, "user");
  input.value = "";

  const loading = document.createElement("div");
  loading.className = "msg bot";
  loading.textContent = "⏳ Processando...";
  chat.appendChild(loading);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: "Você é um assistente útil. Responda em português."
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 1024,
        temperature: 0.7,
        stream: true, // ATIVADO
        top_p: 0.9
      })
    });

    chat.removeChild(loading);

    if (!response.ok) {
      const errorData = await response.json();
      addMsg(`Erro: ${errorData.error?.message || "Erro na API"}`, "bot");
      return;
    }

    // Cria elemento para streaming
    const streamDiv = document.createElement("div");
    streamDiv.className = "msg bot";
    chat.appendChild(streamDiv);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.choices[0]?.delta?.content) {
              fullResponse += parsed.choices[0].delta.content;
              streamDiv.textContent = fullResponse;
              chat.scrollTop = chat.scrollHeight;
            }
          } catch (e) {
            console.warn('Chunk parsing error:', e);
          }
        }
      }
    }

  } catch (err) {
    console.error("Erro streaming:", err);
    chat.removeChild(loading);
    addMsg("Erro ao conectar com Groq API", "bot");
  }
}

// Event Listeners
btn.addEventListener("click", sendMessage); // Ou sendMessageStreaming

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(); // Ou sendMessageStreaming
  }
});

// Botão para limpar chat
function addClearButton() {
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "🧹 Limpar Chat";
  clearBtn.style.cssText = `
    padding: 8px 16px;
    margin: 10px;
    background: #ff4757;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  `;
  clearBtn.onclick = () => {
    chat.innerHTML = '';
    addMsg("👋 Olá! Como posso ajudar hoje?", "bot");
  };
  
  document.body.insertBefore(clearBtn, chat);
}

// Inicializa chat
addMsg("👋 Olá! Estou usando Groq API. Como posso ajudar?", "bot");