import csv
import random

def sample_csv(input_file, output_file, sample_size=500):
    """从CSV文件中随机抽样指定数量的记录"""
    
    # 读取所有行
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)  # 读取表头
        all_rows = list(reader)  # 读取所有数据行
    
    total_rows = len(all_rows)
    print(f"原始文件总行数: {total_rows}")
    print(f"抽样数量: {sample_size}")
    
    # 随机抽样
    if sample_size >= total_rows:
        sampled_rows = all_rows
        print(f"警告: 抽样数量大于等于数据行数，将返回所有数据")
    else:
        sampled_rows = random.sample(all_rows, sample_size)
    
    # 写入新文件
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)  # 写入表头
        writer.writerows(sampled_rows)  # 写入抽样数据
    
    print(f"抽样完成！已保存到: {output_file}")
    print(f"抽样后文件行数: {len(sampled_rows) + 1} (含表头)")

if __name__ == "__main__":
    input_file = r"e:\TRAE_work\csv\产品测试数据_21486202.csv"
    output_file = r"e:\TRAE_work\csv\产品测试数据_21486202_sampled_500.csv"
    
    sample_csv(input_file, output_file, sample_size=500)
