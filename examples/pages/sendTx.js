import styles from '../styles/Home.module.css'
import { Button, ButtonGroup } from '@chakra-ui/react'
import { generateAirdropTransaction } from '../../src/services/GenerateSendFundsTx';

export default function Send() {
  async function handleClick() {
    const tx = await generateAirdropTransaction('11', [{
      address: 'sdfsdf',
      amount: '1'
    }])

    console.log(tx);
  }

  return (
    <div className={styles.container}>
        <Button onClick={handleClick}>Generate Tx</Button>
    </div>
  )
}