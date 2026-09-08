export const inputMasks = {
  br: {
    cpf: '000.000.000-00',
    cnpj: '00.000.000/0000-00',
    postalCode: '00000-000',
    phone: '(00) 0000-0000||(00) 00000-0000',
  },
  jp: {
    postalCode: '000-0000',
    phone: '00-0000-0000||000-0000-0000',
  },
  international: {
    phone: '+00 000 000 000 000',
  },
} as const;
