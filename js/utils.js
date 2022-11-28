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

const fearSuccess = async (message, options = {}) => {
  await Swal.fire({
    icon: 'success',
    title: 'Done',
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

const loadingSVG = (classNames = 'h-4 w-4 text-white') => {
  return `<svg class="animate-spin ${classNames}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>`;
}

const downloadSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
</svg>`;

const shoppingBagSVG = (classNames = 'w-4 h-4') => `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="${classNames}">
<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"></path>
</svg>`;

const getEmailId = email => typeof email === "string" ? email.replace(/@.*/, '') : 'n/a';
