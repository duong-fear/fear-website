const isValidEmailAddress = (input) => {
  // https://emailregex.com/
  const emailPattern = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;
  return emailPattern.test(input);
}

const isValidEtherAmount = (input) => {
  try {
    const ZeroBN = ethers.constants.Zero;
    const valueBN = input instanceof ethers.BigNumber ? input : ethers.utils.parseEther(input);
    return valueBN.gt(ZeroBN);
  } catch {
    return false;
  }
}

const getEpoch = () => Number.parseInt((new Date()).getTime()/1000);

const sleep = seconds => new Promise((resolve) => {
  setTimeout(resolve, seconds*1000);
})

const fearAsk = async (title, message, inputValidator, options = {}) => {
  const { isConfirmed, value, } = await Swal.fire({
    title,
    input: 'text',
    inputLabel: message,
    inputValue: "",
    showCancelButton: true,
    confirmButtonText: "Confirm",
    inputValidator: typeof inputValidator === 'function' ? inputValidator : () => false,
    allowOutsideClick: false,
    ...options,
  });
  return isConfirmed ? value : undefined;
}

const fearInfo = async (title, message) => {
  await Swal.fire({
    title,
    text: message,
    icon: 'info',
    showCancelButton: true,
    showConfirmButton: false,
    cancelButtonText: 'Close',
  });
}

const fearConfirm = async (title, message, confirmButtonText) => {
  const { isConfirmed } = await Swal.fire({
    title,
    text: message,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: confirmButtonText || 'Confirm',
  });
  return isConfirmed;
}

const fearSuccess = async (message, options = { title: 'Done' }) => {
  await Swal.fire({
    icon: 'success',
    text: message,
    confirmButtonText: 'OK',
    ...options
  });
}

const fearError = async (message, options = {}) => {
  const msg = _.get(message, 'message') || message;
  const stack = _.get(message, 'stack');
  const code = _.get(message, 'code');
  if(code === 4001 || code === "ACTION_REJECTED") return; // metamask reject error
  await Swal.fire({
    icon: 'error',
    title: typeof message === "string" ? 'Error' : msg,
    text: msg,
    showCancelButton: true,
    showConfirmButton: false,
    allowOutsideClick: false,
    cancelButtonText: 'Dismiss',
    html: stack ? `<pre class='text-left whitespace-normal'>${stack}</pre>`.trim() : undefined,
    ...options
  });
}

const getExceptionDetails = (ex) => {
	const message = _.get(ex, "reason") || _.get(ex, "error.data.message") || _.get(ex, "error.message") || _.get(ex, "data.message") || _.get(ex, "message") || (typeof ex == "string" && ex) || (Object.hasOwn(ex, 'toString') ? ex.toString() : '<unknown exception>');
	const stack = _.get(ex, "error.stack") || _.get(ex, "stack") || "<no stack>";
  const code = _.get(ex, "code");
  return { message, stack, code, };
	//.replace(/^execution reverted\: /i, '');
}

const loadingSVG = (classNames = 'h-4 w-4') => {
  return `<svg class="animate-spin ${classNames}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>`;
}

const searchSVG = (classNames = 'w-4 h-4') => {
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>`;
}

const downloadSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
</svg>`;

const downloadCircleSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>`;

const arrowLeftCircleSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M11.25 9l-3 3m0 0l3 3m-3-3h7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>`

const starSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
</svg>`;

const shareSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
</svg>`;

const hyperLinkSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
</svg>`;

const clipboardCopied = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
</svg>`;

const shoppingBagSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"></path>
</svg>`;

const getEmailId = email => typeof email === "string" ? email.replace(/@.*/, '') : 'n/a';

const formatEther = input => input instanceof ethers.BigNumber ? ethers.utils.formatEther(input).replace(/.0$/, '') : 'n/a';

const formatEtherHuman = (_input) => {
  let input = null;
  if(typeof _input === 'string') {
    try {
      input = ethers.utils.parseEther(_input);
    } catch {
      return 'n/a';
    }
  }
  if(_input instanceof ethers.BigNumber) input = _input;
  if(!(input instanceof ethers.BigNumber)) return 'n/a';
  const ZeroBN = ethers.constants.Zero;
  const OneEtherBN = ethers.utils.parseEther("1");
  const OneFinneyBN = ethers.utils.parseUnits('1', 'finney');
  const OneThousandEtherBN = ethers.utils.parseEther("1000");
  const OneMillionEtherBN = ethers.utils.parseEther("1000000");
  if(input.gte(OneMillionEtherBN)) return formatEther(input.div(1_000_000).div(OneFinneyBN).mul(OneFinneyBN)) + "M";
  if(input.gte(OneThousandEtherBN)) return formatEther(input.div(1_000).div(OneFinneyBN).mul(OneFinneyBN)) + "K";
  if(input.gte(OneFinneyBN)) return formatEther(input.div(OneFinneyBN).mul(OneFinneyBN));
  if(input.eq(ZeroBN)) return "0";
  return "~0.001";
}

const email2TorusAddress = async (network, verifier, verifierId) => {
  try {
    const fetchNodeDetails = new window.FetchNodeDetails.default();
    const TorusUtils = window.TorusUtils.default;
    const torus = new TorusUtils({
      network,
    });
    const { torusNodeEndpoints, torusNodePub, torusIndexes } = await fetchNodeDetails.getNodeDetails({
      verifier,
      verifierId,
    });
    const publicAddress = await torus.getPublicAddress(torusNodeEndpoints, torusNodePub, { verifier, verifierId });
    return publicAddress;
  } catch(exception) {
    throw exception;
  }
}

const generateBlockscanUrlForAddress = (chainId, address) => {
  const blockScanMap = {
    137: 'https://polygonscan.com/address',
    80001: 'https://mumbai.polygonscan.com/address',
  };
  return `${blockScanMap[chainId]}/${address}`;
}

const onValidEthAmountInput = (e) => {
  const key = e.key;
  if(!/^[\d\.]$/.test(key)) return e.preventDefault();
}

const badWords = [
  "anal",
  "anus",
  "arse",
  "ass",
  "ass fuck",
  "ass hole",
  "assfucker",
  "asshole",
  "assshole",
  "bastard",
  "bitch",
  "black cock",
  "bloody hell",
  "boong",
  "cock",
  "cockfucker",
  "cocksuck",
  "cocksucker",
  "coon",
  "coonnass",
  "crap",
  "cunt",
  "cyberfuck",
  "damn",
  "darn",
  "dick",
  "dirty",
  "douche",
  "dummy",
  "erect",
  "erection",
  "erotic",
  "escort",
  "fag",
  "faggot",
  "fuck",
  "fucking",
  "Fuck off",
  "fuck you",
  "fuckass",
  "fuckhole",
  "god damn",
  "gook",
  "hard core",
  "hardcore",
  "homoerotic",
  "hore",
  "lesbian",
  "lesbians",
  "mother fucker",
  "motherfuck",
  "motherfucker",
  "negro",
  "nigger",
  "orgasim",
  "orgasm",
  "penis",
  "penisfucker",
  "piss",
  "piss off",
  "porn",
  "porno",
  "pornography",
  "pussy",
  "retard",
  "sadist",
  "sex",
  "sexy",
  "shit",
  "slut",
  "son of a bitch",
  "suck",
  "tits",
  "viagra",
  "whore",
  "xxx"
];

const badWordsPattern = new RegExp(badWords.map(b => `\\b${b}\\b`).join('|'), 'gi');

const isEthAddress = input => /^0x[A-Fa-f0-9]{40}$/.test(input) && ethers.utils.isAddress(input);
