import { Table, Column, Model, ForeignKey } from 'sequelize-typescript';
import { Product } from './Product';
import { Tag } from './Tag';

@Table({ tableName: 'product_tags', timestamps: false })
export class ProductTag extends Model<ProductTag> {
  @ForeignKey(() => Product)
  @Column
  product_id!: number;

  @ForeignKey(() => Tag)
  @Column
  tag_id!: number;
}