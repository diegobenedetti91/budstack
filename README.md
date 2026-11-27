# Site da BudStack

Site da BudStack com a venda dos planos da VirtualStore, a área do cliente e o painel de administração.

| Endereço | O que é |
|---|---|
| `/` | Página da BudStack com os produtos (hoje, a VirtualStore) |
| `/virtualstore` | Página da VirtualStore com todos os recursos (`src/app/virtualstore/page.tsx`) |
| `/planos` | Planos, preços, comparativo de recursos (mensal ou anual) |
| `/assinar` | Cria a conta do cliente, pede os dados da loja e o domínio e leva ao Mercado Pago |
| `/entrar`, `/esqueci-senha` | Login único para clientes e para você |
| `/conta` | Área do cliente: assinaturas, pagamentos, pagar renovação/domínio, **cancelar**, desfazer cancelamento, meus dados e senha |
| `/admin` | Só para o admin: visão geral, clientes, BI, planos e recursos, configurações |

## Contas e acesso

- **Um login só.** Cliente e administrador entram em `/entrar`. O papel `ADMIN` vê o grupo **Administração** no menu; o cliente vê só a própria conta.
- O cliente cria a conta (e-mail + senha) no próprio formulário de assinatura. Quem já tem conta entra antes e os dados vêm preenchidos.
- Sessão de 30 dias guardada no banco (o cookie tem um token aleatório; no banco fica só o hash). Trocar a senha desconecta os outros aparelhos.
- Limite de tentativas de login: 5 por conta e 30 por IP a cada 15 minutos.
- Recuperação de senha por e-mail (link de 1 hora, uso único).
- O admin pode bloquear o acesso de um cliente na ficha dele.

## Regras de assinatura

| Situação | O que acontece |
|---|---|
| **Mensal** | Assinatura no cartão do Mercado Pago, cobrada todo mês. Taxa de domínio (se a BudStack registrar) é paga à parte, na área do cliente. |
| **Anual** | Pagamento único no Pix ou cartão parcelado (domínio incluso no mesmo pagamento). Alguns dias antes do vencimento o cliente recebe o link da renovação, com lembrete a 3 dias. |
| **Cancelar** | Quando quiser, sem multa. A loja fica no ar até o fim do período pago e nada mais é cobrado. Dá para desfazer antes do fim (no mensal, o cliente autoriza o cartão de novo). |
| **Pausar ("congelar")** | De 1 a 3 meses (configurável), começando no fim do período pago. Sem cobrança na pausa (no mensal, a assinatura fica pausada no Mercado Pago); volta sozinha ou antes, se o cliente quiser. Só ativa e em dia; uma pausa a cada 6 meses (configurável). No anual, o link da renovação chega antes do fim da pausa. Você é avisado para suspender e depois reativar a loja. |
| **Trocar de plano** | Vale a partir da próxima renovação, sem cobrança dupla (no mensal, o valor é atualizado no Mercado Pago). Escolher o plano atual desfaz a troca. |
| **Reembolso** | Até N dias (padrão 7, CDC art. 49) do primeiro pagamento, o cancelamento estorna tudo no Mercado Pago e encerra na hora. |
| **Inadimplência** | Pagamento não confirmado → "Inadimplente", com N dias de tolerância (padrão 7) e avisos ao cliente. Sem pagamento, a assinatura é encerrada sem multa e você recebe o aviso para **suspender a loja**. Se pagar depois, volta a ficar ativa e você é avisado para reativar. |
| **Preço** | Cada assinatura guarda o valor da compra. Mudar o preço do plano não afeta quem já assinou. |

Você recebe aviso (e-mail + WhatsApp) de: nova assinatura paga (com plano, valor, domínio e origem), taxa de domínio paga, inadimplência, cancelamento agendado, cancelamento com reembolso, encerramento e regularização.

## Painel de administração

- **Visão geral:** clientes ativos, receita recorrente, recebido em 30 dias, inadimplentes, lojas para implantar e cancelamentos agendados.
- **Clientes:** abas Ativos, Inadimplentes, Cancelamento agendado, Para implantar, Aguardando pagamento, Encerrados; busca. Na ficha: plano, período, pagamentos, histórico, domínio, origem, etapa da implantação, conferir no Mercado Pago, cancelar (com estorno se dentro do prazo) e bloquear acesso.
- **BI** (7, 30, 90 dias ou 12 meses): receita recorrente (MRR/ARR), recebido, ticket médio, LTV, ativos, inadimplentes e valor em risco, novas assinaturas, churn, funil (visitantes → planos → assinatura → pagamento → pago), origem dos clientes (Instagram, Google, UTM…), receita e novas × encerradas por mês, planos/ciclos/domínios na base, motivos de cancelamento e páginas mais vistas. Só números agregados.
- **Planos e recursos:** nome, descrição, preço mensal, destaque, ativo e ordem de cada plano; matriz do que cada plano oferece (criar, renomear, ordenar, esconder, apagar recursos).
- **Configurações:** mensalidades cobradas no anual, parcelas, taxa de domínio, prazo de implantação, prazo de reembolso, tolerância de atraso, aviso de renovação, descarte de pedidos não pagos, e-mail/WhatsApp de aviso e contato do site. Mostra também quais integrações estão configuradas.

## Captação (BI)

Cada visita gera um id anônimo (cookie `bs_vid`, sem dados pessoais) e a origem é detectada por UTM, clique de anúncio (`gclid`/`fbclid`), navegador do Instagram/Facebook ou site de onde a pessoa veio. A primeira origem conhecida fica 30 dias no cookie `bs_src` e vai para a assinatura no checkout.
Use links com UTM nas campanhas, ex.: `https://budstack.com.br/?utm_source=instagram&utm_medium=social&utm_campaign=black-friday`.

> **LGPD:** é um cookie de medição próprio e anônimo. Recomendo citar na política de privacidade do site.

## Rodar no computador

```bash
cp .env.example .env          # preencha DATABASE_URL, SITE_URL, ADMIN_*, MP_ACCESS_TOKEN…
npm install
npx prisma migrate deploy     # cria as tabelas e os 3 planos iniciais
npm run setup-admin           # cria o seu usuário admin
npm run dev                   # http://localhost:3000
```

## Publicar na Hostinger

Hoje o `budstack.com.br` é um HTML estático no `public_html`. Este site roda como **aplicação Node.js** (igual às lojas).

1. **Banco:** hPanel → *Bancos de dados → MySQL* → crie um banco e um usuário só para o site da BudStack.
2. **Aplicação:** crie o site `budstack.com.br` como app **Node.js 22** ligado a este repositório (branch `main`).
   - Build: `npm run build` (gera o Prisma, aplica as migrações, cria o admin e compila)
   - Início: `npm start`
3. **Variáveis de ambiente:** cadastre as do [`.env.example`](.env.example).
4. **SSL:** ative o https. O Mercado Pago e o login dependem dele.
5. **Rotina diária de cobrança:** hPanel → *Avançado → Cron Jobs*, 1x por dia:
   ```
   curl -fsS -H "Authorization: Bearer SEU_CRON_SECRET" https://budstack.com.br/api/cron/billing
   ```
   Sem o cron, a rotina roda quando você abre o painel (no máximo a cada 10 min), mas o cron garante renovações e encerramentos no dia certo.
6. Faça um backup do `public_html` atual antes de trocar o site.
7. Entre em `/entrar` com o `ADMIN_EMAIL`, revise **Planos e recursos** e **Configurações** (os preços iniciais são provisórios).

## Mercado Pago

1. *Seu negócio → Configurações → Credenciais de produção*: copie o **Access Token** para `MP_ACCESS_TOKEN`.
2. *Suas integrações → (sua aplicação) → Webhooks*: cadastre `https://budstack.com.br/api/webhooks/mercadopago` com os eventos **Pagamentos**, **Planos e assinaturas** e **Pagamentos recorrentes**. A assinatura mensal depende desse cadastro.
3. O site sempre confere o pagamento na API do Mercado Pago (o aviso só indica o que mudou). A página de obrigado, o botão **Conferir no Mercado Pago** e a rotina diária também conferem.

> **Teste antes de divulgar** com as credenciais de teste do Mercado Pago: assinatura mensal, anual, cancelamento com reembolso e uma cobrança recusada. Na mensal, o Mercado Pago pode exigir que o cliente pague logado com o mesmo e-mail do formulário (o formulário avisa).

## WhatsApp (CallMeBot)

Gratuito, envia mensagens **só para o seu próprio número**:

1. Adicione o número do CallMeBot nos contatos (veja em callmebot.com → WhatsApp API).
2. Envie `I allow callmebot to send me messages`.
3. Ele responde com a **apikey**. Preencha `CALLMEBOT_PHONE` (com DDI) e `CALLMEBOT_APIKEY`.

Os avisos levam dados do cliente (nome, e-mail, WhatsApp, CPF/CNPJ) por esse serviço externo. Para um serviço pago (ex.: Z-API), troque a função `sendWhatsApp` em [`src/lib/notify.ts`](src/lib/notify.ts).

## Estrutura

```
prisma/schema.prisma            usuários, sessões, planos, recursos, configurações, assinaturas, faturas, eventos, visitas
scripts/setup-admin.mjs         cria o admin no build
src/lib/auth.ts                 login, sessões, limite de tentativas
src/lib/billing.ts              regras de assinatura: início, conferência no MP, renovação, atraso, cancelamento, rotina diária
src/lib/mercadopago.ts          chamadas à API do Mercado Pago
src/lib/notify.ts               avisos por e-mail e WhatsApp
src/lib/settings*.ts            configurações do painel (com validação)
src/lib/plans.ts                planos e recursos (banco)
src/lib/bi.ts, tracking.ts      BI e captação
src/app/(auth)                  entrar, esqueci a senha, nova senha
src/app/(area)/conta            área do cliente
src/app/(area)/admin            painel de administração
src/app/api                     webhook do MP, cron de cobrança, contador de visitas
```
