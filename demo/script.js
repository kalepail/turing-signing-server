document.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault()

  const formData = new FormData(e.target)

  fetch('https://stellar-smart-contract.glitch.me/GCNANNNLGDICM5NJOT7QD7MLW34M4WLJPTNOAXWEAR4CE4LO23FZ5WDR', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: formData.get('to'),
      source: formData.get('source'),
      amount: formData.get('amount'),
    }),
  })
  .then((response) => response.text())
  .then((result) => {
    document.querySelector('textarea').value = result
    document.querySelector('.stellar-expert').href = `https://laboratory.stellar.org/#txsigner?xdr=${encodeURIComponent(result)}&network=test`
  })
  .catch((err) => console.error(err))
})