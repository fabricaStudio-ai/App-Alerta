/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { AppContext, DecisionResponse } from "../types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDVr-5zwc9te2X4NMff_jai5FaBUIv34lw";

export class DecisionEngine {
  private ai: GoogleGenAI;

  constructor() {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  async processContext(context: AppContext): Promise<DecisionResponse> {
    const prompt = `
      Você é o motor de decisão de um aplicativo de segurança pessoal.
      Interprete o contexto abaixo e devolva a resposta estruturada em JSON.

      CONTEXTO RECEBIDO:
      ${JSON.stringify(context, null, 2)}

      Siga rigorosamente as instruções de classificação de risco (1-4) e as prioridades de decisão.
      Responda APENAS o JSON.
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nivel_risco: { type: Type.INTEGER },
            fase_evento: { type: Type.STRING },
            motivo_classificacao: { type: Type.STRING },
            mensagem_usuario: { type: Type.STRING },
            acoes_recomendadas: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            acoes_app: {
              type: Type.OBJECT,
              properties: {
                iniciar_gravacao: { type: Type.BOOLEAN },
                salvar_localizacao: { type: Type.BOOLEAN },
                modo_silencioso: { type: Type.BOOLEAN },
                alertar_contatos: { type: Type.BOOLEAN },
                sugerir_ligacao_emergencia: { type: Type.BOOLEAN },
                registrar_evento_local: { type: Type.BOOLEAN },
                pronto_para_sync: { type: Type.BOOLEAN },
                gerar_relatorio_pos_evento: { type: Type.BOOLEAN }
              },
              required: [
                "iniciar_gravacao", "salvar_localizacao", "modo_silencioso", 
                "alertar_contatos", "sugerir_ligacao_emergencia", 
                "registrar_evento_local", "pronto_para_sync", "gerar_relatorio_pos_evento"
              ]
            },
            estado_rede: {
              type: Type.OBJECT,
              properties: {
                internet_disponivel: { type: Type.BOOLEAN },
                gps_disponivel: { type: Type.BOOLEAN },
                orientacao_offline: { type: Type.STRING }
              },
              required: ["internet_disponivel", "gps_disponivel", "orientacao_offline"]
            },
            firebase: {
              type: Type.OBJECT,
              properties: {
                usar_auth: { type: Type.BOOLEAN },
                usuario_autenticado: { type: Type.BOOLEAN },
                salvar_firestore_quando_possivel: { type: Type.BOOLEAN },
                salvar_storage_quando_possivel: { type: Type.BOOLEAN }
              },
              required: ["usar_auth", "usuario_autenticado", "salvar_firestore_quando_possivel", "salvar_storage_quando_possivel"]
            },
            proximo_passo: { type: Type.STRING }
          },
          required: [
            "nivel_risco", "fase_evento", "motivo_classificacao", "mensagem_usuario", 
            "acoes_recomendadas", "acoes_app", "estado_rede", "firebase", "proximo_passo"
          ]
        },
        systemInstruction: `
          Você é um assistente operacional de segurança. 
          Classifique o risco de 1 a 4.
          Nível 1: Desconforto/Assédio verbal.
          Nível 2: Perseguição/Intimidação.
          Nível 3: Ameaça direta/Bloqueio.
          Nível 4: Agressão/Violência física.
          
          Priorize segurança física. 
          Se internet_disponivel for false, não prometa alertas externos.
          Se risco >= 2, iniciar_gravacao e salvar_localizacao devem ser true se disponíveis.
          Se risco >= 3, mensagem curta e alertar_contatos se possível.
          Se risco = 4, instruções mínimas, priorizar fuga.
          Responda SEMPRE e SOMENTE em JSON válido.
        `
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini response:", response.text);
      throw new Error("Erro ao processar decisão de segurança.");
    }
  }
}
