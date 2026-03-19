import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { CampaignLead } from '../models/CampaignLead';
import { Lead } from '../models/Lead';
import { logger } from '../utils/logger';

let client: Client | null = null;
let clientReady: Promise<void> | null = null;

const initClient = () => {
  if (client && clientReady) return clientReady;

  const sessionPath = process.env.WA_SESSION_PATH ?? '.wa-session';
  const headless = (process.env.WA_HEADLESS ?? 'true') === 'true';
  const executablePath = process.env.WA_PUPPETEER_EXECUTABLE_PATH;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    puppeteer: {
      headless,
      executablePath: executablePath || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    logger.info('WhatsApp QR received. Scan to authenticate.');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    logger.info('WhatsApp client is ready.');
  });

  client.on('auth_failure', (msg) => {
    logger.error(`WhatsApp auth failure: ${msg}`);
  });

  client.on('disconnected', (reason) => {
    logger.warn(`WhatsApp disconnected: ${reason}`);
  });

  client.on('message', async (message) => {
    try {
      if (message.fromMe) return;
      const from = message.from || '';
      if (!from.endsWith('@c.us')) return;
      const digits = from.replace(/\D/g, '');
      if (!digits) return;

      const last10 = digits.slice(-10);
      const phoneRegex = new RegExp(`${last10}$`);

      const lead = await Lead.findOne({
        $or: [
          { phone: { $regex: phoneRegex } },
          { alternatePhone: { $regex: phoneRegex } },
        ],
      }).sort({ updatedAt: -1 });

      if (!lead) return;

      const now = new Date();
      lead.responseStatus = 'replied';
      lead.respondedAt = now;
      lead.lastInboundAt = now;
      if (lead.status === 'new' || lead.status === 'contacted') {
        lead.status = 'interested';
      }
      await lead.save();

      const campaignLead = await CampaignLead.findOne({
        leadId: lead._id,
        messageStatus: 'sent',
      }).sort({ updatedAt: -1 });

      if (campaignLead) {
        campaignLead.responseStatus = 'replied';
        campaignLead.responseAt = now;
        await campaignLead.save();
      }

      logger.info(`Inbound reply tracked for ${lead.businessName ?? lead.fullName}`);
    } catch (err: any) {
      logger.error(`Inbound message tracking failed: ${err.message}`);
    }
  });

  clientReady = new Promise((resolve, reject) => {
    client?.once('ready', () => resolve());
    client?.once('auth_failure', () => reject(new Error('WhatsApp auth failure')));
  });

  client.initialize().catch((err) => {
    logger.error(`WhatsApp init error: ${err.message}`);
  });

  return clientReady;
};

export const ensureWhatsAppReady = async () => {
  const ready = initClient();
  await ready;
};

export const sendWhatsAppMessage = async (
  whatsappId: string,
  message: string,
  imagePath?: string | null
) => {
  await ensureWhatsAppReady();

  if (!client) {
    throw new Error('WhatsApp client not initialized');
  }

  if (imagePath) {
    const media = MessageMedia.fromFilePath(imagePath);
    await client.sendMessage(whatsappId, media, { caption: message });
  } else {
    await client.sendMessage(whatsappId, message);
  }
};
