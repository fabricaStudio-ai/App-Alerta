/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum RiskLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
  LEVEL_4 = 4,
}

export type EventPhase = "ativo" | "pos_evento";

export interface DecisionResponse {
  nivel_risco: RiskLevel;
  fase_evento: EventPhase;
  motivo_classificacao: string;
  mensagem_usuario: string;
  acoes_recomendadas: string[];
  acoes_app: {
    iniciar_gravacao: boolean;
    salvar_localizacao: boolean;
    modo_silencioso: boolean;
    alertar_contatos: boolean;
    sugerir_ligacao_emergencia: boolean;
    registrar_evento_local: boolean;
    pronto_para_sync: boolean;
    gerar_relatorio_pos_evento: boolean;
  };
  estado_rede: {
    internet_disponivel: boolean;
    gps_disponivel: boolean;
    orientacao_offline: string;
  };
  firebase: {
    usar_auth: boolean;
    usuario_autenticado: boolean;
    salvar_firestore_quando_possivel: boolean;
    salvar_storage_quando_possivel: boolean;
  };
  proximo_passo: string;
}

export interface AppContext {
  fala_usuario: string;
  internet_disponivel: boolean;
  gps_disponivel: boolean;
  gravacao_disponivel: boolean;
  contatos_configurados: boolean;
  modo_silencioso_ativado: boolean;
  usuario_autenticado: boolean;
  suporte_firebase_auth: boolean;
  suporte_firestore: boolean;
  suporte_storage: boolean;
  evento_encerrado?: boolean;
  local_seguro_confirmado?: boolean;
  ultima_localizacao_disponivel?: string;
  historico_resumido_evento?: string;
}
