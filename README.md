# Site da BudStack

Site institucional da BudStack com venda dos planos da VirtualStore.

| Endereço | O que é |
|---|---|
| `/` | Página da BudStack com os produtos (hoje, a VirtualStore) |
| `/virtualstore` | Landing da VirtualStore (HTML estático em `public/virtualstore.html`) |
| `/planos` | Os 3 planos, mensal ou anual |
| `/assinar` | Dados do cliente, nome da loja, domínio → pagamento no Mercado Pago |
| `/assinar/obrigado` | Situação do pedido após o pagamento (e pagamento da taxa de domínio, no mensal) |
| `/admin/login`, `/admin` | Seu painel: assinaturas, domínio de cada cliente e etapa da implantação |

## Como a venda funciona

1. O cliente escolhe o plano e o ciclo e preenche os dados, o nome da loja e o domínio: se já tem um, ou se quer que a BudStack registre.
2. **Anual:** pagamento único no Mercado Pago (Pix ou cartão em até 12x). A taxa de registro do domínio entra no mesmo pagamento.
   **Mensal:** assinatura no cartão, cobrada todo mês. A taxa do domínio é paga à parte, na página do pedido, logo depois.
3. O Mercado Pago avisa o site (`/api/webhooks/mercadopago`). O site **confere o pagamento direto na API do Mercado Pago**, marca a assinatura como paga e envia:
   - para você: **e-mail** (`NOTIFY_EMAIL`) e **WhatsApp** (CallMeBot) com o plano, o valor, o cliente e o domínio;
   - para o cliente: e-mail de confirmação com os próximos passos.
4. A assinatura aparece no painel em **Para implantar**. Ali você muda a etapa (Novo → Configurando → No ar) e faz anotações.

O aviso sai uma única vez por assinatura, mesmo se o Mercado Pago repetir a notificação.

## Preços e planos

Tudo fica em [`src/lib/plans.ts`](src/lib/plans.ts): mensalidades, itens de cada plano, meses cobrados no anual, parcelas, taxa de domínio e prazo de implantação.
**Os valores que estão lá são provisórios. Troque-os antes de publicar.**
Cada assinatura guarda o valor do momento da compra; mudar o preço não afeta quem já assinou.

## Rodar no computador

```bash
cp .env.example .env    # preencha DATABASE_URL, SESSION_SECRET, ADMIN_*, MP_ACCESS_TOKEN…
npm install
npx prisma migrate deploy
npm run dev             # http://localhost:3000
```

## Publicar na Hostinger

Hoje o `budstack.com.br` é um HTML estático no `public_html`. Este site precisa de Node.js (pagamento, login e avisos), então passa a rodar como **aplicação Node.js**, do mesmo jeito que as lojas.

1. **Banco:** hPanel → *Bancos de dados → MySQL* → crie um banco e um usuário só para o site da BudStack.
2. **Aplicação:** crie o site `budstack.com.br` como app **Node.js 22** ligado a este repositório (branch `main`).
   - Build: `npm run build` (aplica as migrações do banco e compila)
   - Início: `npm start`
3. **Variáveis de ambiente:** cadastre as do [`.env.example`](.env.example) no app.
   - `SESSION_SECRET`: `openssl rand -hex 32`
   - `ADMIN_PASSWORD`: 10 ou mais caracteres. Para trocar a senha, mude a variável e reinicie o app.
4. **SSL:** ative o https no domínio. O Mercado Pago e o login dependem dele.
5. Faça um backup do `public_html` atual antes de trocar o site.

## Mercado Pago

1. *mercadopago.com.br → Seu negócio → Configurações → Credenciais de produção*: copie o **Access Token** para `MP_ACCESS_TOKEN`.
2. *Suas integrações → (sua aplicação) → Webhooks*: cadastre `https://budstack.com.br/api/webhooks/mercadopago` e marque os eventos **Pagamentos**, **Planos e assinaturas** e **Pagamentos recorrentes**.
   O pagamento único já envia o endereço sozinho. A assinatura mensal **depende** desse cadastro.
3. Mesmo sem o aviso, a página `/assinar/obrigado` e o botão **Conferir no Mercado Pago** do painel consultam o pagamento na hora.

> **Teste antes de divulgar:** faça uma assinatura mensal e uma anual com as credenciais de teste do Mercado Pago. Na assinatura mensal, o Mercado Pago pode exigir que o cliente pague logado com o mesmo e-mail informado no formulário (o formulário avisa isso).

## WhatsApp (CallMeBot)

Serviço gratuito que manda mensagens **só para o seu próprio número**:

1. Adicione o número do CallMeBot nos contatos (veja o número atual em callmebot.com → WhatsApp API).
2. Envie para ele a mensagem `I allow callmebot to send me messages`.
3. Ele responde com a sua **apikey**. Preencha `CALLMEBOT_PHONE` (seu número com DDI, ex.: `5519999999999`) e `CALLMEBOT_APIKEY`.

Se preferir um serviço pago e mais estável (ex.: Z-API), é só trocar a função `sendWhatsApp` em [`src/lib/notify.ts`](src/lib/notify.ts).

## Estrutura

```
public/virtualstore.html      landing da VirtualStore
prisma/schema.prisma          tabela Subscription
src/lib/plans.ts              planos e preços
src/lib/subscriptions.ts      cria a assinatura, confere no Mercado Pago, marca como paga
src/lib/mercadopago.ts        chamadas à API do Mercado Pago
src/lib/notify.ts             avisos por e-mail e WhatsApp
src/lib/session.ts, auth.ts   login do painel (cookie assinado, limite de tentativas)
src/proxy.ts                  protege /admin
src/app/…                     páginas
```
