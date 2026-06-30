import Mesas from './Mesas';

interface HomeProps {
  business?: { id?: string } | null;
  userRole?: string;
}

function Home({ business, userRole = 'admin' }: HomeProps) {
  return (
    <div>
      <Mesas businessId={business?.id} userRole={userRole} />
    </div>
  );
}

export default Home;
