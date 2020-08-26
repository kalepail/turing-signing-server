# npx sls logs --service tss-0 -f runContract
loadtest -n 60 -c 1 -k --rps 1 --data '{"to":"GAWSNOA5AMEXLQ2SJM65RH25CEM7O7OV7ZYBSGSGNFUGBJBCGQRAAHOX","source":"GAWSNOA5AMEXLQ2SJM65RH25CEM7O7OV7ZYBSGSGNFUGBJBCGQRAAHOX","amount":"100"}' -T 'application/json' -m POST https://tss-0.stellar.buzz/contract/GCNANNNLGDICM5NJOT7QD7MLW34M4WLJPTNOAXWEAR4CE4LO23FZ5WDR/run

loadtest -n 100 -k -T 'application/json' -m GET https://flower-es7-staging.begin.app