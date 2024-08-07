const ABIHelper = require('../../common/abi')
const support = require('../../common/support')
const httpRequest = require('request-promise')
const { LegacyTransaction } = require('@ethereumjs/tx')
const Web3_Utils = require('web3-utils')

let customChain = null
let contractAddr = null
let createGasHex = '0x30D40' // gas: 200000
const gasUp = 1000

const createObj = {
  inputs: [
    { name: '_id', type: 'uint256' },
    { name: '_fileHash', type: 'bytes32' },
    { name: '_expTimestamp', type: 'uint256' },
  ],
  name: 'createDocument',
  type: 'function',
}
const checkObj = {
  inputs: [
    { name: '_id', type: 'uint256' },
    { name: '_fileHash', type: 'bytes32' },
  ],
  name: 'checkDocument',
  type: 'function',
}
const getDocObj = {
  inputs: [{ name: '_id', type: 'uint256' }],
  name: 'getDocument',
  type: 'function',
}

const request = {
  method: 'POST',
  uri: null,
  json: true,
  headers: { 'Content-Type': 'application/json' },
  resolveWithFullResponse: true,
  timeout: 150000,
  body: [],
}

exports.getUri = function () {
  return request.uri
}

exports.setContractAddress = function (_contractAddr) {
  contractAddr = _contractAddr
}

exports.setTestEnv = function (_httpRpcUrl, _contractAddr, _httpheaders, chainId = 0, _gas = 70000) {
  contractAddr = _contractAddr
  gasHex = Web3_Utils.toHex(_gas)
  request.uri = _httpRpcUrl
  request.headers = _httpheaders

  // if (contractAddr == undefined || contractAddr == null || !contractAddr.startsWith('0x')) {
  //     throw new Error('wrong contract address')
  // }

  if (chainId == 0) {
    let value = support.getChainId(_httpRpcUrl)
    chainId = Web3_Utils.hexToNumber(value)
  }
  customChain = support.customChain(chainId)
}

const estimateGasDocuBody = {
  jsonrpc: '2.0',
  method: 'eth_estimateGas',
  params: [],
  id: 1,
}
exports.createEstimateGas = function (senderAddr, _id = 12345, _fileHash = '0x11111111111111111111111111111111ffffffffffffffffffffffffffffffff') {
  const txData = {
    from: senderAddr,
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(createObj, [`${_id}`, `${_fileHash}`, `${Math.ceil(+new Date() / 100)}`]),
  }
  estimateGasDocuBody.params = [txData]
  estimateGasDocuBody.id++
  //console.log(txData)
  request.body = estimateGasDocuBody

  return new Promise(function (resolve, reject) {
    httpRequest
      .post(request)
      .then((response) => {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
          //console.log(account, Web3_Utils.hexToNumber(response.body.result), JSON.stringify(response))
          let _gas = Web3_Utils.hexToNumber(response.body.result)
          createGasHex = Web3_Utils.numberToHex(_gas + gasUp)
          resolve(_gas)
        } else {
          console.error(response.body)
          // 초기 상태 검증 => contract 불일치(?)
          process.exit(2)
        }
      })
      .catch((err) => {
        console.error(err)
        // 초기 상태 검증 => contract 불일치(?)
        process.exit(2)
      })
  })
}

exports.createReq = function (senderKey, nonce, _id, _fileHash, _expTimestamp) {
  const hrTime = process.hrtime()
  const reqId = hrTime[0] * 1000000000 + hrTime[1]

  const txData = {
    nonce: `${Web3_Utils.toHex(nonce)}`,
    gasLimit: createGasHex,
    gasPrice: '0x00', // 10 Gwei
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(createObj, [`${_id}`, `${_fileHash}`, `${_expTimestamp}`]),
  }

  // sign the transaction
  const txObj = LegacyTransaction.fromTxData(txData, customChain)
  //console.log(`tx: ${JSON.stringify(txObj)}`)
  const signedObj = txObj.sign(senderKey)
  //console.log(`signed tx: ${JSON.stringify(signedObj)}`)
  const signedTx = signedObj.serialize()
  const signedTxHex = Buffer.from(signedTx).toString('hex')

  // fire away!
  const _body = {
    jsonrpc: '2.0',
    method: 'eth_sendRawTransaction',
    params: [`0x${signedTxHex}`],
    id: reqId,
  }

  return {
    method: 'POST',
    uri: request.uri,
    json: true,
    headers: request.headers,
    resolveWithFullResponse: true,
    timeout: 150000,
    body: _body,
  }
}

const callDocuBody = {
  jsonrpc: '2.0',
  method: 'eth_call',
  params: [],
  id: 100,
}
exports.checkDoc = function (_id, _fileHash) {
  const txData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(checkObj, [`${_id}`, `${_fileHash}`]),
  }
  callDocuBody.params = [txData, 'latest']
  callDocuBody.id++
  //console.log(txData)
  request.body = callDocuBody

  return new Promise(function (resolve, reject) {
    httpRequest
      .post(request)
      .then((response) => {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
          //console.log(account, Web3_Utils.hexToNumber(response.body.result), JSON.stringify(response))
          resolve(Web3_Utils.hexToNumber(response.body.result))
        } else {
          console.error(response.body)
        }
      })
      .catch((err) => {
        console.error(err)
      })
  })
}

exports.getDoc = function (_id) {
  const txData = {
    to: contractAddr,
    data: ABIHelper.getCallDataByABI(getDocObj, [`${_id}`]),
  }
  callDocuBody.params = [txData, 'latest']
  callDocuBody.id++
  //console.log(txData)
  request.body = callDocuBody

  return new Promise(function (resolve, reject) {
    httpRequest
      .post(request)
      .then((response) => {
        if (response.body.result !== undefined && typeof response.body.result === 'string' && response.body.result.startsWith('0x')) {
          //console.log(account, Web3_Utils.hexToNumber(response.body.result), JSON.stringify(response))
          let resStr = response.body.result
          //console.log(resStr)
          let docObj = {
            id: Web3_Utils.hexToNumberString(resStr.substring(0, 2 + 64)),
            filehash: '0x' + resStr.substring(2 + 64, 2 + 64 * 2),
            regTimestamp: Web3_Utils.hexToNumber('0x' + resStr.substring(2 + 64 * 2, 2 + 64 * 3)),
            expiredTime: Web3_Utils.hexToNumber('0x' + resStr.substring(2 + 64 * 3, 2 + 64 * 4)),
            owner: '0x' + resStr.substring(26 + 64 * 4, 2 + 64 * 5),
            actived: Number(resStr.substring(2 + 64 * 5, 2 + 64 * 6)),
          }
          resolve(docObj)
          // resolve(response.body.result)
        } else {
          console.error(response.body)
          // 초기 상태 검증 => contract 불일치(?)
          process.exit(2)
        }
      })
      .catch((err) => {
        console.error(err)
        // 초기 상태 검증 => contract 불일치(?)
        process.exit(2)
      })
  })
}
