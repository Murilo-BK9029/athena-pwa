# Athena Finanças

Sistema de controle financeiro pessoal e multiusuário em formato **PWA (Progressive Web App)** integrado ao **Google Sheets** via **Google Apps Script**, projetado para substituir planilhas manuais com leitura rápida, organização mensal e isolamento de dados por usuário.

## Arquitetura do Projeto

- **Front-end (PWA):** HTML5, CSS3 (com suporte a múltiplos temas) e JavaScript modular (`index.html`, `styles.css`, `app.js`, `manifest.json`, `service-worker.js`), hospedado via GitHub Pages.
- **Back-end (API):** Google Apps Script (`doGet` / `doPost`) conectado a uma planilha Google Sheets específica por meio de `ScriptProperties` (`SPREADSHEET_ID` e `API_ACCESS_KEY`).
- **Isolamento de Dados:** Cada usuário configura sua própria URL `/exec` e `API_ACCESS_KEY` localmente no navegador/dispositivo (`localStorage`), mantendo planilhas e lançamentos 100% separados.

## Principais Funcionalidades

- **Início (Visão Executiva):** KPIs consolidados (*Patrimônio Total*, *Caixa Disponível*, *Faturas em Aberto* e *A Receber*), resumo do mês atual com status de conferência (*Em aberto* / *Conferido ✓*) e alertas de pendências.
- **Contas:** Exibição individual do saldo atual por conta/banco até a data de hoje, sem misturar contas nem somar faturas de cartão.
- **Movimentações:** Agrupamento mensal colapsável com filtros por mês, tipo, conta e busca textual, padronização de datas (`DD/MM/AAAA`) e textos, suporte a lançamentos recorrentes e exclusão de lançamentos.
- **Cartões:** Faturas detalhadas por mês e por cartão, regras individuais de fechamento e vencimento por cartão, separação entre **Minha Parte** e **Terceiros / Rateio**, saldo restante de parcelamentos e resumo mensal consolidado.
- **Terceiros:** Cadastro dinâmico de pessoas, chips de filtro rápido, situação de *Pendente* vs. *Quitado* por pessoa e extrato mensal.
- **Investimentos:** Lançamento de aportes, resgates e proventos, atualização de cotações, gráfico por ativo, **Posição Consolidada** (quantidade líquida, preço médio, cotação e valor) e **Histórico de Operações**.
- **Fluxo 2027:** Gráfico mensal comparativo e cronograma até `12/2027` com controle de conferência mensal.
- **Configurações:** Seleção entre 4 temas visuais (`Azul / Escuro`, `Branco / Branco`, `Escuro` e `Azul / Branco`), configuração de fechamento/vencimento por cartão e conexão com o Google Apps Script.

## Como Implantar Para Outro Usuário

1. Crie uma nova planilha no Google Drive da pessoa e copie o **ID da planilha** da URL (`/d/<ID>/edit`).
2. Crie um projeto no **Google Apps Script** na conta da pessoa com os arquivos `.gs` do backend usando `getAthenaSpreadsheet()`.
3. Em **Configurações do projeto > Propriedades do script**, cadastre `SPREADSHEET_ID` e uma `API_ACCESS_KEY` exclusiva.
4. Publique como **Aplicativo da Web** (*Executar como: Eu* / *Quem pode acessar: Qualquer pessoa*) e copie a URL `/exec`.
5. Abra o PWA, acesse **Configurações**, salve a URL `/exec` e a `API_ACCESS_KEY` e clique em **Sincronizar**.
