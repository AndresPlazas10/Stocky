import { Text, View } from 'react-native';
import { StockyMoneyText } from '../../../ui/StockyMoneyText';
import { reportesStyles as s } from '../reportesStyles';

interface TopSellerItem {
  sellerName: string;
  total: number;
  count: number;
}

interface TopSellersProps {
  items: TopSellerItem[];
}

export function TopSellers({ items }: TopSellersProps) {
  return (
    <View style={s.blockCard}>
      <Text style={s.sectionTitle}>Top vendedores</Text>
      {items.length === 0 ? (
        <Text style={s.emptyText}>No hay ventas asignadas a vendedores en este período.</Text>
      ) : (
        items.map((item, index) => (
          <View key={item.sellerName} style={s.sellerRow}>
            <View style={s.rankBadge}>
              <Text style={s.rankText}>#{index + 1}</Text>
            </View>
            <View style={s.sellerMain}>
              <Text style={s.sellerName}>{item.sellerName}</Text>
              <Text style={s.sellerMeta}>{item.count} ventas</Text>
            </View>
            <StockyMoneyText value={item.total} style={s.sellerTotal} />
          </View>
        ))
      )}
    </View>
  );
}
