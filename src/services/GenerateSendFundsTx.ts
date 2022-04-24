import { OptionalBlock, AddressItem, Balance, Asset, UtxoBox } from './types';
import * as ergoRust from "ergo-lib-wasm-browser";

declare global {
  const ergo: {
    get_utxos: (a: string, b: string) => Promise<UtxoBox[]>;
    get_change_address: Function;
    get_used_addresses: Function;
    get_unused_addresses: Function;
    sign_tx: Function;
    submit_tx: Function;
  };

  const ergo_request_read_access: Function;
  const ergo_check_read_access: Function;

}
const MIN_FEE = 1000000;

export class GenerateSendFundsTx {
  constructor() {

  }

  call() {

  }
}

export function isDappConnectorInstalled() {
  return (typeof ergo_request_read_access === "function")
}

export async function isWalletAccessibleForRead() {
  return await ergo_check_read_access()
}

export async function requestWalletReadAcess() {
  return await ergo_request_read_access()
}


export async function generateAirdropTransaction(tokenId: string, list: AddressItem[]) {
  const height = await currentHeight();
  return await sendFunds(tokenId, list, { height })
}


export async function currentHeight() {
  return fetch('https://api.ergoplatform.com/api/v0/blocks?limit=1')
    .then((res: Response) => res.json())
    .then(res => res.items[0].height)
}


export async function sendFunds(tokenId: string, addressList: AddressItem[], block: OptionalBlock) {
  const wasm = await ergoRust;
  const optimalTxFee = calculateOptimalFee(addressList)
  const need = {
    ERG: MIN_FEE * addressList.length + optimalTxFee,
    [tokenId]: addressList.reduce(function (a, b) {
      return a + parseInt(b.amount);
    }, 0)
  }

  let have = JSON.parse(JSON.stringify(need));

  console.log({have})
  console.log({need})
  let boxes: UtxoBox[] = [];


  const keys = Object.keys(have)

  const totalBalance = await loadTokensFromWallet();

  if (keys.filter(key => key !== 'ERG').filter(key => !Object.keys(totalBalance).includes(key) || totalBalance[key].amount < have[key]).length > 0) {
    throw Error('Not enough balance in the wallet!')

  }

  for (let i = 0; i < keys.length; i++) {
    if (have[keys[i]] <= 0) continue
    const currentBoxes = await ergo.get_utxos(have[keys[i]].toString(), keys[i]);
    if (currentBoxes !== undefined) {
      currentBoxes.forEach(bx => {
        have['ERG'] -= parseInt(bx.value)
        bx.assets.forEach(asset => {
          if (!Object.keys(have).includes(asset.tokenId)) have[asset.tokenId] = 0
          console.log(asset.name, have[asset.tokenId], asset.amount)
          have[asset.tokenId] -= parseInt(asset.amount)
        })
      })
      boxes = boxes.concat(currentBoxes)
    }
  }

  if (keys.filter(key => have[key] > 0).length > 0) {
    throw Error('Not enough balance in the wallet!')
  }

  const fundBoxes = addressList.map(item => {
    return {
      value: MIN_FEE.toString(),
      ergoTree: wasm.Address.from_mainnet_str(item.address).to_ergo_tree().to_base16_bytes(),
      assets: [{
        tokenId,
        amount: item.amount.toString()
      }],
      additionalRegisters: {},
      creationHeight: block.height
    }
  });


  const feeBox = {
    value: optimalTxFee.toString(),
    creationHeight: block.height,
    ergoTree: "1005040004000e36100204a00b08cd0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798ea02d192a39a8cc7a701730073011001020402d19683030193a38cc7b2a57300000193c2b2a57301007473027303830108cdeeac93b1a57304",
    assets: [],
    additionalRegisters: {},
  }

  const changeBox = {
    value: (-have['ERG']).toString(),
    ergoTree: wasm.Address.from_mainnet_str(await ergo.get_change_address()).to_ergo_tree().to_base16_bytes(),
    assets: Object.keys(have).filter(key => key !== 'ERG')
      .filter(key => have[key] < 0)
      .map(key => {
        return {
          tokenId: key,
          amount: (-have[key]).toString()
        }
      }),
    additionalRegisters: {},
    creationHeight: block.height
  }

  const unsigned = {
    inputs: boxes.map(box => {
      return {
        ...box,
        extension: {}
      }
    }),
    outputs: [changeBox, ...fundBoxes, feeBox],
    dataInputs: [],
    fee: optimalTxFee
  }

  // let tx = null
  // try {
  //   tx = await ergo.sign_tx(unsigned)
  //   console.log("signed tx:", tx)
  // } catch (e) {
  //   throw Error('Error while sending funds')
  // }

  // const txId = await ergo.submit_tx(tx)

  return unsigned
}


interface Dic {
    [key: string]: Asset
}

export async function loadTokensFromWallet() {
  const addresses: string = (await ergo.get_used_addresses()).concat(await ergo.get_unused_addresses())
  let tokens: Dic = {}

  for (let i = 0; i < addresses.length; i++) {
    const balance: Balance = (await getBalance(addresses[i]));
    balance.tokens.forEach((asset: Asset) => {
      if (!Object.keys(tokens).includes(asset.tokenId))
        tokens[asset.tokenId] = {
          amount: 0,
          name: asset.name,
          tokenId: asset.tokenId
        }
      tokens[asset.tokenId].amount += asset.amount;
    })
  }
  return tokens
}

export async function getBalance(addr: string): Promise<Balance> {
  return await fetch(`https://api.ergoplatform.com/api/v1/addresses/${addr}/balance/confirmed`).then(res => res.json());
}

export function calculateOptimalFee(addressList: AddressItem[]) {
  return Math.round(MIN_FEE + (addressList.length * MIN_FEE / 5))
}