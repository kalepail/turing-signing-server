import axios from 'axios'

const isDev = process.env.NODE_ENV === 'development'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = isDev ? 0 : 1

export default async () => {
  await axios.post(
    isDev
    ? 'https://localhost:4000/dev/contract/GCNANNNLGDICM5NJOT7QD7MLW34M4WLJPTNOAXWEAR4CE4LO23FZ5WDR/run'
    : 'https://aefrqlrkb3.execute-api.us-east-1.amazonaws.com/dev/contract/GCNANNNLGDICM5NJOT7QD7MLW34M4WLJPTNOAXWEAR4CE4LO23FZ5WDR/run',
    {
      to: 'GAWSNOA5AMEXLQ2SJM65RH25CEM7O7OV7ZYBSGSGNFUGBJBCGQRAAHOX',
      source: 'GAWSNOA5AMEXLQ2SJM65RH25CEM7O7OV7ZYBSGSGNFUGBJBCGQRAAHOX',
      sequence: '10561324580865',
      amount: '100'
    }
  )

  return 'AAAAAC0muB0DCXXDUks92J9dERn3fdX+cBkaRmloYKQiNCIAAAAAZAAACZsAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAALAAAAAAAAAAAAAAAAAAAAAA=='
}